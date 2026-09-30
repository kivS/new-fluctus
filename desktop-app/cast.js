// Cast Youtube videos to smart TVs on the local network.
//
// Devices are found with SSDP (DIAL search). Two ways to start playback:
// - DIAL: TVs with a DIAL Youtube app (Samsung, LG, Roku, Fire TV, ...) get a
//   POST with the video id and start time.
// - Chromecast / Google TV: launch the Youtube receiver over the Cast v2
//   protocol, read its screen id, then queue the video through Youtube's
//   lounge API (the same flow the Youtube phone app uses).
const crypto = require('crypto')
const dgram = require('dgram')
const http = require('http')
const https = require('https')
const os = require('os')
const tls = require('tls')
const { URL } = require('url')

const SSDP_ADDRESS = '239.255.255.250'
const SSDP_PORT = 1900
const DIAL_SEARCH_TARGET = 'urn:dial-multiscreen-org:service:dial:1'
const DISCOVERY_TIMEOUT_MS = 3000
const HTTP_TIMEOUT_MS = 5000

const CAST_PORT = 8009
const CAST_TIMEOUT_MS = 20000
const CAST_YOUTUBE_APP_ID = '233637DE'
const CAST_NAMESPACE = {
    connection: 'urn:x-cast:com.google.cast.tp.connection',
    heartbeat: 'urn:x-cast:com.google.cast.tp.heartbeat',
    receiver: 'urn:x-cast:com.google.cast.receiver',
    youtube: 'urn:x-cast:com.google.youtube.mdx'
}

// macOS answers with these when the app isn't allowed to use the local network
const BLOCKED_NETWORK_ERROR_CODES = new Set(['EHOSTUNREACH', 'EPERM', 'EACCES'])

const LOUNGE_TOKEN_URL = 'https://www.youtube.com/api/lounge/pairing/get_lounge_token_batch'
const LOUNGE_BIND_URL = 'https://www.youtube.com/api/lounge/bc/bind'

// ---------------------------------------------------------------------------
// Discovery

function getLocalIPv4Addresses() {
    return Object.values(os.networkInterfaces())
        .flat()
        .filter((address) => address && address.family === 'IPv4' && !address.internal)
        .map((address) => address.address)
}

function parseHeaders(rawResponse) {
    const headers = {}
    rawResponse.split('\r\n').slice(1).forEach((line) => {
        const separatorIndex = line.indexOf(':')
        if (separatorIndex <= 0) return
        headers[line.slice(0, separatorIndex).trim().toLowerCase()] = line.slice(separatorIndex + 1).trim()
    })
    return headers
}

function searchSsdp(timeoutMs) {
    const searchMessage = Buffer.from([
        'M-SEARCH * HTTP/1.1',
        `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}`,
        'MAN: "ssdp:discover"',
        'MX: 2',
        `ST: ${DIAL_SEARCH_TARGET}`,
        '', ''
    ].join('\r\n'))

    const localAddresses = getLocalIPv4Addresses()
    // Search from every interface so a VPN or secondary adapter doesn't hide the TV
    const bindAddresses = localAddresses.length > 0 ? localAddresses : [undefined]
    const responses = new Map()
    const sendErrors = []
    const sockets = []

    return new Promise((resolve) => {
        bindAddresses.forEach((bindAddress) => {
            const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
            sockets.push(socket)

            socket.on('error', (error) => {
                console.warn(`SSDP search failed on ${bindAddress || 'default interface'}:`, error.message)
                try { socket.close() } catch (closeError) { /* already closed */ }
            })

            socket.on('message', (message) => {
                const headers = parseHeaders(message.toString())
                if (headers.location) {
                    responses.set(headers.location, { location: headers.location, server: headers.server || '' })
                }
            })

            socket.bind({ address: bindAddress, port: 0 }, () => {
                const send = () => socket.send(searchMessage, SSDP_PORT, SSDP_ADDRESS, (error) => {
                    if (error) sendErrors.push(error)
                })
                send()
                // SSDP is UDP, so repeat once in case the first packet gets dropped
                setTimeout(send, 500)
            })
        })

        setTimeout(() => {
            sockets.forEach((socket) => {
                try { socket.close() } catch (error) { /* already closed */ }
            })
            resolve({ responses: [...responses.values()], sendErrors })
        }, timeoutMs)
    })
}

function httpRequest(url, { method = 'GET', body, headers = {} } = {}) {
    const client = url.startsWith('https:') ? https : http

    return new Promise((resolve, reject) => {
        const request = client.request(url, { method, headers }, (response) => {
            let responseBody = ''
            response.setEncoding('utf8')
            response.on('data', (chunk) => { responseBody += chunk })
            response.on('end', () => resolve({
                statusCode: response.statusCode,
                headers: response.headers,
                body: responseBody
            }))
        })

        request.setTimeout(HTTP_TIMEOUT_MS, () => {
            request.destroy(new Error(`Request to ${url} timed out`))
        })
        request.on('error', reject)
        if (body) request.write(body)
        request.end()
    })
}

function readXmlTag(xml, tagName) {
    const match = xml.match(new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'i'))
    return match ? decodeXmlEntities(match[1].trim()) : ''
}

function decodeXmlEntities(value) {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
}

function getDialYoutubeAppUrl(applicationUrl) {
    return `${applicationUrl.replace(/\/?$/, '/')}YouTube`
}

async function describeDevice({ location, server }) {
    const description = await httpRequest(location)
    const applicationUrl = description.headers['application-url']
    if (description.statusCode !== 200 || !applicationUrl) return null

    const youtubeApp = await httpRequest(getDialYoutubeAppUrl(applicationUrl)).catch(() => null)
    let protocol = null

    if (youtubeApp?.statusCode === 200) {
        protocol = 'dial'
    } else if (/chromecast/i.test(server) || new URL(location).port === '8008') {
        protocol = 'chromecast'
    }

    // Skip DIAL devices without Youtube (speakers, set-top boxes, etc.)
    if (!protocol) return null

    return {
        id: readXmlTag(description.body, 'UDN') || location,
        name: readXmlTag(description.body, 'friendlyName') || new URL(location).hostname,
        model: [readXmlTag(description.body, 'manufacturer'), readXmlTag(description.body, 'modelName')]
            .filter(Boolean)
            .join(' '),
        host: new URL(location).hostname,
        applicationUrl,
        protocol
    }
}

async function discoverCastDevices() {
    const { responses: ssdpResponses, sendErrors } = await searchSsdp(DISCOVERY_TIMEOUT_MS)

    if (ssdpResponses.length === 0 && sendErrors.some((error) => BLOCKED_NETWORK_ERROR_CODES.has(error.code))) {
        console.warn('SSDP search blocked:', sendErrors.map((error) => error.code).join(', '))
        const error = new Error('Fluctus is not allowed to use the local network.')
        error.code = 'LOCAL_NETWORK_BLOCKED'
        throw error
    }

    const devices = await Promise.all(ssdpResponses.map((response) => describeDevice(response).catch((error) => {
        console.warn(`Unable to describe DIAL device at ${response.location}:`, error.message)
        return null
    })))

    const uniqueDevices = new Map()
    devices.filter(Boolean).forEach((device) => uniqueDevices.set(device.id, device))

    return [...uniqueDevices.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------------------
// DIAL playback

async function castWithDial(device, videoId, startSeconds) {
    const params = new URLSearchParams({ v: videoId, t: `${startSeconds}` })
    const response = await httpRequest(getDialYoutubeAppUrl(device.applicationUrl), {
        method: 'POST',
        body: params.toString(),
        headers: { 'Content-Type': 'text/plain; charset="utf-8"' }
    })

    // 201 = launched, 200 = already running and accepted the new video
    if (response.statusCode !== 201 && response.statusCode !== 200) {
        throw new Error(`TV refused the request (HTTP ${response.statusCode})`)
    }
}

// ---------------------------------------------------------------------------
// Cast v2 protocol: length-prefixed protobuf CastMessage over TLS.
// Only string payloads are needed, so the protobuf is encoded by hand.

function encodeVarint(value) {
    const bytes = []
    while (value > 0x7f) {
        bytes.push((value & 0x7f) | 0x80)
        value >>>= 7
    }
    bytes.push(value)
    return Buffer.from(bytes)
}

function encodeStringField(fieldNumber, value) {
    const data = Buffer.from(value, 'utf8')
    return Buffer.concat([encodeVarint((fieldNumber << 3) | 2), encodeVarint(data.length), data])
}

function encodeCastMessage({ sourceId, destinationId, namespace, payload }) {
    const message = Buffer.concat([
        encodeVarint((1 << 3) | 0), encodeVarint(0), // protocol_version = CASTV2_1_0
        encodeStringField(2, sourceId),
        encodeStringField(3, destinationId),
        encodeStringField(4, namespace),
        encodeVarint((5 << 3) | 0), encodeVarint(0), // payload_type = STRING
        encodeStringField(6, JSON.stringify(payload))
    ])

    const lengthPrefix = Buffer.alloc(4)
    lengthPrefix.writeUInt32BE(message.length)
    return Buffer.concat([lengthPrefix, message])
}

function decodeCastMessage(buffer) {
    const fields = {}
    let offset = 0

    const readVarint = () => {
        let result = 0
        let shift = 0
        let byte
        do {
            byte = buffer[offset++]
            result += (byte & 0x7f) * 2 ** shift
            shift += 7
        } while (byte & 0x80)
        return result
    }

    while (offset < buffer.length) {
        const key = readVarint()
        const fieldNumber = key >>> 3
        const wireType = key & 0x7

        if (wireType === 0) {
            fields[fieldNumber] = readVarint()
        } else if (wireType === 2) {
            const length = readVarint()
            fields[fieldNumber] = buffer.slice(offset, offset + length)
            offset += length
        } else {
            throw new Error(`Unsupported protobuf wire type ${wireType}`)
        }
    }

    let payload = null
    try {
        payload = fields[6] ? JSON.parse(fields[6].toString('utf8')) : null
    } catch (error) { /* non-JSON payload, ignore */ }

    return {
        sourceId: fields[2]?.toString('utf8'),
        namespace: fields[4]?.toString('utf8'),
        payload
    }
}

function withTimeout(promise, timeoutMs, message) {
    let timer
    return Promise.race([
        promise,
        new Promise((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error(message)), timeoutMs)
        })
    ]).finally(() => clearTimeout(timer))
}

class CastConnection {
    constructor(host) {
        this.host = host
        this.sourceId = `sender-${crypto.randomBytes(4).toString('hex')}`
        this.requestId = 1
        this.listeners = new Set()
        this.pending = Buffer.alloc(0)
    }

    connect() {
        return new Promise((resolve, reject) => {
            // Cast devices use self-signed certificates
            this.socket = tls.connect({ host: this.host, port: CAST_PORT, rejectUnauthorized: false }, () => {
                this.send('receiver-0', CAST_NAMESPACE.connection, { type: 'CONNECT' })
                resolve()
            })
            this.socket.on('data', (chunk) => this.onData(chunk))
            this.socket.on('error', reject)
        })
    }

    onData(chunk) {
        this.pending = Buffer.concat([this.pending, chunk])

        while (this.pending.length >= 4) {
            const length = this.pending.readUInt32BE(0)
            if (this.pending.length < 4 + length) break

            const message = decodeCastMessage(this.pending.slice(4, 4 + length))
            this.pending = this.pending.slice(4 + length)

            if (message.namespace === CAST_NAMESPACE.heartbeat && message.payload?.type === 'PING') {
                this.send(message.sourceId, CAST_NAMESPACE.heartbeat, { type: 'PONG' })
                continue
            }

            this.listeners.forEach((listener) => listener(message))
        }
    }

    send(destinationId, namespace, payload) {
        this.socket.write(encodeCastMessage({ sourceId: this.sourceId, destinationId, namespace, payload }))
    }

    request(destinationId, namespace, payload, matches) {
        const requestId = this.requestId++
        const response = this.waitFor((message) => {
            if (message.namespace !== namespace) return false
            return matches ? matches(message) : message.payload?.requestId === requestId
        })
        this.send(destinationId, namespace, { ...payload, requestId })
        return response
    }

    waitFor(matches) {
        return withTimeout(new Promise((resolve) => {
            const listener = (message) => {
                if (!matches(message)) return
                this.listeners.delete(listener)
                resolve(message)
            }
            this.listeners.add(listener)
        }), CAST_TIMEOUT_MS, 'The TV took too long to respond.')
    }

    close() {
        this.socket?.destroy()
    }
}

async function getYoutubeScreenId(host) {
    const connection = new CastConnection(host)

    try {
        await withTimeout(connection.connect(), CAST_TIMEOUT_MS, 'Could not connect to the TV.')

        const findYoutubeApp = (message) => message.payload?.status?.applications
            ?.find((application) => application.appId === CAST_YOUTUBE_APP_ID ||
                // Android TV / Google TV run the native Youtube app under its own id
                application.universalAppId === CAST_YOUTUBE_APP_ID)

        // LAUNCH answers with a RECEIVER_STATUS once the Youtube app is up
        const launchStatus = await connection.request('receiver-0', CAST_NAMESPACE.receiver, {
            type: 'LAUNCH',
            appId: CAST_YOUTUBE_APP_ID
        }, (message) => message.payload?.type === 'LAUNCH_ERROR' || Boolean(findYoutubeApp(message)))

        if (launchStatus.payload.type === 'LAUNCH_ERROR') {
            throw new Error(`The TV could not open Youtube (${launchStatus.payload.reason || 'unknown reason'}).`)
        }

        const { transportId } = findYoutubeApp(launchStatus)
        connection.send(transportId, CAST_NAMESPACE.connection, { type: 'CONNECT' })

        const sessionStatus = await connection.request(transportId, CAST_NAMESPACE.youtube, {
            type: 'getMdxSessionStatus'
        }, (message) => message.payload?.type === 'mdxSessionStatus')

        const screenId = sessionStatus.payload?.data?.screenId
        if (!screenId) throw new Error('The TV did not share a Youtube screen id.')
        return screenId
    } finally {
        connection.close()
    }
}

function postForm(url, params, headers = {}) {
    return httpRequest(url.toString(), {
        method: 'POST',
        body: new URLSearchParams(params).toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }
    })
}

async function playOnYoutubeScreen(screenId, videoId, startSeconds) {
    const tokenResponse = await postForm(LOUNGE_TOKEN_URL, { screen_ids: screenId })
    const loungeToken = JSON.parse(tokenResponse.body)?.screens?.[0]?.loungeToken
    if (!loungeToken) throw new Error('Youtube did not return a lounge token for the TV.')

    const loungeHeaders = { 'X-YouTube-LoungeId-Token': loungeToken }
    let rid = 0

    const bindUrl = new URL(LOUNGE_BIND_URL)
    bindUrl.search = new URLSearchParams({ RID: `${rid++}`, VER: '8', CVER: '1' }).toString()
    const bindResponse = await postForm(bindUrl, {
        device: 'REMOTE_CONTROL',
        id: crypto.randomUUID(),
        name: 'Fluctus',
        'mdx-version': '3',
        pairing_type: 'cast',
        app: 'android-phone-13.14.55'
    }, loungeHeaders)

    const sid = bindResponse.body.match(/"c","(.*?)",/)?.[1]
    const gsessionId = bindResponse.body.match(/"S","(.*?)"]/)?.[1]
    if (!sid || !gsessionId) throw new Error('Unable to start a Youtube session with the TV.')

    const playlistUrl = new URL(LOUNGE_BIND_URL)
    playlistUrl.search = new URLSearchParams({
        SID: sid,
        gsessionid: gsessionId,
        RID: `${rid++}`,
        VER: '8',
        CVER: '1'
    }).toString()

    const playlistResponse = await postForm(playlistUrl, {
        count: '1',
        req0__sc: 'setPlaylist',
        req0_videoId: videoId,
        req0_listId: '',
        req0_currentTime: `${startSeconds}`,
        req0_currentIndex: '-1',
        req0_audioOnly: 'false'
    }, loungeHeaders)

    if (playlistResponse.statusCode !== 200) {
        throw new Error(`Youtube refused to queue the video (HTTP ${playlistResponse.statusCode}).`)
    }
}

async function castWithChromecast(device, videoId, startSeconds) {
    const screenId = await getYoutubeScreenId(device.host)
    await playOnYoutubeScreen(screenId, videoId, startSeconds)
}

// ---------------------------------------------------------------------------

async function castYoutubeVideo(device, videoId, startSeconds) {
    const wholeSeconds = Math.max(0, Math.floor(startSeconds || 0))

    if (device.protocol === 'chromecast') {
        return castWithChromecast(device, videoId, wholeSeconds)
    }

    return castWithDial(device, videoId, wholeSeconds)
}

module.exports = {
    discoverCastDevices,
    castYoutubeVideo
}
