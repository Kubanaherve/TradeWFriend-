export const sendWhatsAppMessage = (
  phone: string,
  items: { name: string; qty: number; price: number }[],
  amount: number
) => {
  // Format items list
  const formattedItems = items
    .map((item) => `- ${item.name} (${item.qty} x ${item.price} FRW)`)
    .join("\n");

  // Build message
  const message = `Muraho neza! Wampaye kuri cash nshuti. Merci!!

${formattedItems}

Amafaranga totale ni: ${amount} FRW`;

  // Encode message for URL
  const encodedMessage = encodeURIComponent(message);

  // Normalize phone number (optional but recommended)
  const normalizedPhone = phone.startsWith("0")
    ? "250" + phone.slice(1)
    : phone;

  // Open WhatsApp
  window.open(
    `https://wa.me/${normalizedPhone}?text=${encodedMessage}`,
    "_blank"
  );
};