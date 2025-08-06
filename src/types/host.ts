import { HostType } from "./enums";

export interface Host {
  ip: string | null;
  origin: string;
  type: HostType;
}
