import * as stream from "stream";

/**
 * Creates a writable stream that writes output to the specified writer.
 * @param writer - The writable stream to write output to.
 * @returns A function that takes a string and writes it to the writer.
 */
export function outWriter(writer: stream.Writable): (s: string) => void {
  return (s: string) => {
    writer.write(s + "\n");
  };
}
