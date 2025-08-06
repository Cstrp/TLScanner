# 🚀 TLScanner

> **Lightning-fast TLS 1.3 + HTTP/2 endpoint discovery tool**  
> _Built with NestJS, TypeScript & modern Node.js_

![License](https://img.shields.io/badge/license-MIT-red.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![NestJS](https://img.shields.io/badge/NestJS-11-red?logo=nestjs)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![pnpm](https://img.shields.io/badge/pnpm-latest-orange?logo=pnpm)

---

### 🔧 What is TLScanner?

**TLScanner** is a high-speed, multithreaded CLI tool for scanning and analyzing **TLS 1.3 + HTTP/2** enabled endpoints.

- 🧵 **Highly concurrent** (1-100+ threads)
- 🌐 **Smart IP/domain scanner**: CIDR, single IPs, domain lists, URLs
- 🔍 **GeoIP ready**: Built-in MaxMind support
- 📦 **CSV export**: Easy to analyze, import, filter
- 🚦 **Feasibility checks**: Only TLSv1.3 + H2 targets are logged
- 🌀 **Infinite mode**: Scan ranges without limits

---

### ⚡ Fast Start

```bash
pnpm install
pnpm run scan -- -addr "8.8.8.8" -thread 10 -v
```

➡️ Automatically scans forward (`8.8.8.9`, `8.8.8.10`, ...)  
📦 Saves to `out.csv`  
🧭 Detects certs, issuers, geo, protocols

---

### 🔥 Features at a Glance

- ✅ TLS 1.3 / HTTP2 Detection
- ✅ Certificate Authority Analysis
- ✅ Domain/IP/URL Input Support
- ✅ Graceful Shutdown with Logging
- ✅ IPv4 / IPv6 Support
- ✅ Lightweight CSV Output
- ✅ GeoIP Country Mapping

---

### 📌 Example Use Cases

- Security Recon & Mapping
- Certificate Authority Audits
- Mirror Scanner / CDN Discovery
- TLS Deployment Analysis
- Country/Region-Specific Recon

---

### 💡 CLI Examples

```bash
# Scan a full subnet
pnpm run scan -addr "10.0.0.0/24" -thread 20 -out net.csv

# Scan from file
pnpm run scan -in targets.txt -thread 10

# Extract from webpage
pnpm run scan -url "https://example.com/mirrors" -out mirrors.csv
```

---

### 📦 Output Format

```csv
IP,ORIGIN,CERT_DOMAIN,CERT_ISSUER,GEO_CODE
8.8.8.8,8.8.8.8,dns.google,Google Trust Services LLC,US
```

Only **TLS 1.3 + HTTP/2** endpoints with valid certs are recorded.

---

### 🛠️ Tech Stack

| Tool        | Usage                   |
| ----------- | ----------------------- |
| NestJS      | CLI + app structure     |
| TypeScript  | Type safety everywhere  |
| MaxMind     | GeoIP lookups           |
| Node.js TLS | Native TLS inspection   |
| pnpm        | Fast dependency manager |

---

### 🧠 Developer Notes

- Built as a TypeScript-first CLI with **nest-commander**
- Supports **infinite scan**, backoff, graceful exits
- Fully typed and modular

---

![TLScanner Preview](./.github/preview/preview.gif)
