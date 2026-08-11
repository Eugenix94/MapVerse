import type { Handler, HandlerEvent } from "@netlify/functions";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const locations = event.queryStringParameters?.locations || "";
  if (!locations) {
    return { statusCode: 400, body: "Missing locations parameter" };
  }

  try {
    const url = `https://api.opentopodata.org/v1/srtm30m?locations=${encodeURIComponent(locations)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "MapVerseProxy/1.0",
        "Accept": "*/*",
      },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: await response.text(),
      };
    }

    const data = await response.text();
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: data,
    };
  } catch (err: any) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Elevation API failed", detail: err.message }),
    };
  }
};

export { handler };
