export default async function handler(req, res) {
  const { imageUrl, caption, igAccountId, accessToken } = req.body;

  // Step 1: 미디어 컨테이너 생성
  const container = await fetch(
    `https://graph.facebook.com/v19.0/${igAccountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      caption: caption,
      access_token: accessToken
    })
  });
  const { id } = await container.json();

  // Step 2: 실제 발행
  const publish = await fetch(
    `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: id, access_token: accessToken })
  });

  const result = await publish.json();
  res.status(200).json(result);
}
