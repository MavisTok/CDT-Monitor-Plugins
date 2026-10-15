// Installation URLs stay on main; only runtime assets follow the release version.
export function releaseInfo(pkg) {
  const repository = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\.git$/.exec(pkg.repository?.url)?.[1];
  if (!repository || !/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error('A GitHub repository and release version are required.');
  const raw = `https://raw.githubusercontent.com/${repository}/`;
  return {
    tag: `v${pkg.version}`,
    scriptRoot: `${raw}v${pkg.version}/`,
    install: {
      ios: `${raw}refs/heads/main/surge/CDT-Monitor.sgmodule`,
      mac: `${raw}refs/heads/main/surge/CDT-Monitor-Mac.sgmodule`,
      loon: `${raw}refs/heads/main/loon/CDT-Monitor.plugin`,
      egern: `${raw}refs/heads/main/egern/CDT-Monitor.yaml`,
      stash: `${raw}refs/heads/main/stash/CDT-Monitor.stoverride`
    },
    guide: `https://github.com/${repository}/blob/main/README.md`
  };
}
