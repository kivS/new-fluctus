
## How to handle certificates

### Production

- Get only the certificate without altering our nginx config: `sudo certbot certonly --nginx`

- Dry run of certificates renewal: `sudo certbot renew --dry-run`

### Localhost 

- Create the folder for the certificates: `mkdir /etc/letsencrypt/live/fluctus.segrob.studio`

- Create a local certificate if it doesn't exist. We need to have certbot installed just so we can replicate the same structure as in production
```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/letsencrypt/live/fluctus.segrob.studio/privkey.pem -out /etc/letsencrypt/live/fluctus.segrob.studio/fullchain.pem
```