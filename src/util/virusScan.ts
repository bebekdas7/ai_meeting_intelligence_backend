const NodeClam = require("clamscan");

let clamav: any = null;

export async function getClamAVInstance() {
  if (clamav) return clamav;

  const clamscan = new NodeClam();

  clamav = await clamscan.init({
    removeInfected: false,
    quarantineInfected: false,
    scanLog: null,
    debugMode: false,
    fileList: null,
    scanRecursively: false,
    clamscan: {
      path: "clamscan",
      db: null,
      scanArchives: true,
      active: true,
    },
    clamdscan: {
      socket: false,
      host: "127.0.0.1",
      port: 3310,
      timeout: 60000,
      localFallback: true,
      path: "clamdscan",
      configFile: null,
      multiscan: true,
      reloadDb: false,
      active: true,
    },
    preference: "clamdscan",
  });

  return clamav;
}

export async function scanFileForVirus(filePath: string): Promise<boolean> {
  const clam = await getClamAVInstance();
  const result = await clam.isInfected(filePath);

  return !result.isInfected;
}
