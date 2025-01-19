const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Genera un enlace de pago para un token
 */
exports.createPaymentLink = async (chatId) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Token de Acceso',
              description: 'Compra tu token de acceso válido por 30 días',
            },
            unit_amount: 500, // Monto en centavos (500 = $5.00 USD)
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.SERVER_URL}/success?chatId=${chatId}`, // URL a donde redirigir después del pago exitoso
      cancel_url: `${process.env.SERVER_URL}/cancel`,
      metadata: {
        chatId, // Guardar el ID del usuario de Telegram
      },
    });
    return session.url;
  } catch (error) {
    console.error('Error al crear enlace de pago:', error);
    throw error;
  }
};