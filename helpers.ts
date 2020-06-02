export function stat(st) {
  return {
    mtime: st.mtime || new Date(),
    atime: st.atime || new Date(),
    ctime: st.ctime || new Date(),
    size: st.size !== undefined ? st.size : 0,
    mode:
      st.mode === 'dir'
        ? 16877
        : st.mode === 'file'
        ? 33188
        : st.mode === 'link'
        ? 41453
        : st.mode,
    uid: st.uid !== undefined ? st.uid : process.getuid(),
    gid: st.gid !== undefined ? st.gid : process.getgid(),
  };
}

export function directory(entries: string[]): string[] {
  return ['.', '..', ...entries];
}
