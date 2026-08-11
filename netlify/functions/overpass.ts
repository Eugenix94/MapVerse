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

  const body = event.body || "";

  let lastError: string = "";

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "MapVerse/1.0 (https://mapverse0.netlify.app)",
        },
        body,
      });

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
        lastError = `${endpoint}: ${response.status} ${response.statusText}`;
        console.warn(`Overpass endpoint failed: ${lastError}`);
      }
    } catch (err: any) {
      lastError = `${endpoint}: ${err.message}`;
      console.warn(`Overpass endpoint error: ${lastError}`);
    }
  }

  return {
    statusCode: 502,
    body: JSON.stringify({ error: "All Overpass API endpoints failed", lastError }),
  };
};

export { handler };
