chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(["globalSettings", "sites"]);
  if (!existing.sites) await chrome.storage.local.set({ sites: {} });
});
