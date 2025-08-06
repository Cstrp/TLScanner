export interface TLSScanResult {
  ip: string;
  origin: string;
  domain: string;
  issuer: string;
  geoCode: string;
  feasible: boolean;
  tlsVersion: string;
  alpn: string;
}
