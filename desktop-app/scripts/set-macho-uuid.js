// Give the app's main executable its own Mach-O UUID.
//
// Every Electron app ships the same prebuilt binary, so they all share one
// LC_UUID. macOS Local Network privacy tracks apps by that UUID, which makes
// it mix Fluctus up with other Electron apps: the permission prompt never
// shows and Fluctus never appears in System Settings → Local Network.
const crypto = require('crypto')
const fs = require('fs')

const MH_MAGIC_64 = 0xfeedfacf
const FAT_MAGIC = 0xcafebabe
const LC_UUID = 0x1b

// Derived from the bundle id so every build keeps the same UUID and macOS
// remembers the permission across deploys
function uuidFor(seed) {
    const bytes = crypto.createHash('sha256').update(seed).digest().subarray(0, 16)
    bytes[6] = (bytes[6] & 0x0f) | 0x50 // version 5 style
    bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant
    return bytes
}

function patchThinBinary(buffer, offset, uuid) {
    if (buffer.readUInt32LE(offset) !== MH_MAGIC_64) {
        throw new Error('Unsupported Mach-O binary (expected 64-bit little endian)')
    }

    const commandCount = buffer.readUInt32LE(offset + 16)
    let commandOffset = offset + 32

    for (let index = 0; index < commandCount; index++) {
        const command = buffer.readUInt32LE(commandOffset)
        if (command === LC_UUID) {
            uuid.copy(buffer, commandOffset + 8)
            return
        }
        commandOffset += buffer.readUInt32LE(commandOffset + 4)
    }

    throw new Error('Mach-O binary has no LC_UUID load command')
}

function setMachOUuid(executablePath, seed) {
    const buffer = fs.readFileSync(executablePath)
    const uuid = uuidFor(seed)

    if (buffer.readUInt32BE(0) === FAT_MAGIC) {
        const archCount = buffer.readUInt32BE(4)
        for (let index = 0; index < archCount; index++) {
            patchThinBinary(buffer, buffer.readUInt32BE(8 + index * 20 + 8), uuid)
        }
    } else {
        patchThinBinary(buffer, 0, uuid)
    }

    fs.writeFileSync(executablePath, buffer)
}

module.exports = { setMachOUuid }
