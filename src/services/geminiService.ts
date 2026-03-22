import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const geminiService = {
  async recognizePlate(imageBase64: string): Promise<{ plate: string; type: string } | null> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: "Extract the license plate number and the type of vehicle (moto, car, bus, or truck) from this image. Consider the vehicle's size, shape, and features to accurately identify its type. Return the result in JSON format with keys 'plate' and 'type'." },
              { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text || "{}");
      return {
        plate: result.plate?.toUpperCase() || "",
        type: result.type?.toLowerCase() || "car"
      };
    } catch (error) {
      console.error("Gemini Recognition Error:", error);
      return null;
    }
  },

  async readQRCode(imageBase64: string): Promise<any | null> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: "Read the QR code in this image and extract its content. We are looking for transaction details like 'plate', 'type' (moto, car, bus, truck), 'paymentMethod' (cash, mobile_money, card, subscription, bank_transfer), 'currency' (USD, CDF), and 'operator' (MTN, Orange, Airtel). If the content is JSON, return it as a JSON object. If it's a string, try to parse it or return it as a JSON object with a 'content' key. Return the result in JSON format." },
              { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("Gemini QR Code Error:", error);
      return null;
    }
  },

  async getAddressFromLocation(lat: number, lng: number): Promise<string | null> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `What is the exact address or location name for these coordinates: ${lat}, ${lng}? Return only the address string.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng
              }
            }
          }
        }
      });
      return response.text?.trim() || null;
    } catch (error) {
      console.error("Gemini Geocoding Error:", error);
      return null;
    }
  }
};
