import type { Handler, HandlerEvent } from "@netlify/functions";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const handler: Handler = async (event: HandlerEvent) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body = event.body || "";
  if (event.isBase64Encoded) {
    body = Buffer.from(body, "base64").toString("utf-8");
  }

  let errors: string[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000); // 7 seconds so we can try at least one other before 10s limit
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "MapVerseProxy/1.0",
          "Accept": "*/*",
        },
        body,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.text();
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: data,
        };
      } else {
        const errText = await response.text();
        const errStr = `${endpoint}: ${response.status} ${response.statusText} - ${errText.substring(0, 100)}`;
        errors.push(errStr);
        console.warn(`Overpass endpoint failed: ${errStr}`);
      }
    } catch (err: any) {
      const errStr = `${endpoint}: ${err.message}`;
      errors.push(errStr);
      console.warn(`Overpass endpoint error: ${errStr}`);
    }
  }

  return {
    statusCode: 502,
    body: JSON.stringify({ error: "All Overpass API endpoints failed", details: errors }),
  };
};

export { handler };
