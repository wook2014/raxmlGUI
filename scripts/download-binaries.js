const fs = require('fs').promises;
const path = require('path');
const download = require('download');

const osName = (() => {
  switch (process.platform) {
    case "darwin":
      return "Mac";
    case "win32":
      return "Windows";
    default:
      return "Linux";
  }
})();

const binariesBaseDir = "https://github.com/AntonelliLab/raxmlGUI/releases/download/binaries-20.04/";
const binariesUrl = `${binariesBaseDir}/${osName}.zip`;

const binPath = path.join(__dirname, "..", "static", "bin", osName);
const raxmlNgPath = path.join(binPath, "raxml-ng");

(async () => {
  console.log("Check binaries...");
  let exist = true;
  try {
    await fs.access(raxmlNgPath, );
  } catch (_) {
    exist = false;
  }

  if (exist) {
    console.log("Binaries exist!");
    return;
  }

  console.log(`Binaries missing, downloading from '${binariesUrl}'...`);

	await download(binariesUrl, binPath, {
    extract: true,
  });
  console.log("Done!")

})();