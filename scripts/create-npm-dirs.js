/**
 * Create npm sub-package directories with proper package.json files
 * for each platform supported by signalis-codec.
 *
 * This script runs automatically before `napi artifacts` via the
 * "preartifacts" npm hook. It follows the same lean-packaging model as
 * @brashkie/signalis-core: the main package ships only the loader + JS/TS,
 * and each platform's .node lives in its own optionalDependency package.
 */

const fs = require('fs');
const path = require('path');

const mainPkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'),
);
const VERSION = mainPkg.version;
const SCOPE = '@brashkie';
const BASE_NAME = 'signalis-codec';

// Each entry: folder name + os/cpu (+ libc for Linux) + the .node filename.
// Must stay in sync with the build matrix in .github/workflows/release.yml.
const PLATFORMS = [
  {
    folder: 'linux-x64-gnu',
    os: 'linux',
    cpu: 'x64',
    libc: 'glibc',
    nodeFile: 'signalis-codec.linux-x64-gnu.node',
  },
  {
    folder: 'win32-x64-msvc',
    os: 'win32',
    cpu: 'x64',
    nodeFile: 'signalis-codec.win32-x64-msvc.node',
  },
  {
    folder: 'darwin-x64',
    os: 'darwin',
    cpu: 'x64',
    nodeFile: 'signalis-codec.darwin-x64.node',
  },
  {
    folder: 'darwin-arm64',
    os: 'darwin',
    cpu: 'arm64',
    nodeFile: 'signalis-codec.darwin-arm64.node',
  },
];

const npmDir = path.join(__dirname, '..', 'npm');

if (!fs.existsSync(npmDir)) {
  fs.mkdirSync(npmDir, { recursive: true });
}

console.log('📦 Creating npm sub-package directories...\n');

for (const platform of PLATFORMS) {
  const platformDir = path.join(npmDir, platform.folder);
  fs.mkdirSync(platformDir, { recursive: true });

  const subPkg = {
    name: `${SCOPE}/${BASE_NAME}-${platform.folder}`,
    version: VERSION,
    cpu: [platform.cpu],
    main: platform.nodeFile,
    files: [platform.nodeFile],
    description: `Native binary for ${SCOPE}/${BASE_NAME} (${platform.os} ${platform.cpu})`,
    keywords: ['protobuf', 'codec', 'wire-format', 'rust', 'napi'],
    author: mainPkg.author,
    license: mainPkg.license,
    homepage: mainPkg.homepage,
    repository: mainPkg.repository,
    bugs: mainPkg.bugs,
    engines: {
      node: '>= 18',
    },
    os: [platform.os],
  };

  if (platform.libc) {
    subPkg.libc = [platform.libc];
  }

  fs.writeFileSync(
    path.join(platformDir, 'package.json'),
    JSON.stringify(subPkg, null, 2) + '\n',
  );

  const readme = `# \`${subPkg.name}\`

Platform-specific binary for [\`${SCOPE}/${BASE_NAME}\`](https://www.npmjs.com/package/${SCOPE}/${BASE_NAME}).

This is the **${platform.os} ${platform.cpu}${platform.libc ? ' (' + platform.libc + ')' : ''}** binary build.

You should not install this package directly. Install \`${SCOPE}/${BASE_NAME}\` instead — npm will install this sub-package automatically based on your platform.

## License

${mainPkg.license}
`;

  fs.writeFileSync(path.join(platformDir, 'README.md'), readme);
  console.log(`  ✓ ${subPkg.name}`);
}

console.log(`\n✅ Created ${PLATFORMS.length} platform sub-packages\n`);
