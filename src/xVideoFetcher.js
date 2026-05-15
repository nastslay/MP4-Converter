export function extractTweetId(url) {
  const regex = /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Zawsze używa naszego API do pobrania bezpośredniego URL wideo
export async function fetchXVideoUrl(tweetUrl) {
  const apiUrl = `/api/download?url=${encodeURIComponent(tweetUrl)}`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Błąd API');
  }
  const data = await response.json();
  return data.videoUrl;
}