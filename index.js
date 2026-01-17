require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

const token = process.env.BOT_TOKEN;
const adminId = process.env.ADMIN_ID;
const cardNumber = process.env.CARD_NUMBER || '8600000000000000';

const bot = new TelegramBot(token, { polling: true });

const userOrders = {};

// Render.com uchun kichik server (Port xatosi chiqmasligi uchun)
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running...\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server ${PORT}-portda ishlamoqda`);
});

const menu = {
    '🌯 Lavash-klassika': 18000,
    '🥙 Lavash-pishloqli': 20000,
    '🌭 Hot-dog-karalevski': 20000,
    '🥖 Hot-dog-klassika': 15000,
    '🧀 Hot-dog-pishloqli': 22000,
    '🌮 Non-kabob': 13000,
    '☕️ Cofee': 7000,
    '🥤 Coca-Cola 1L': 12000,
    '🥤 Fanta 1L': 12000,
    '🥤 Shishali-Coca-Cola 0.5L': 5000,
};

console.log('Fast Food Bot ishga tushdi...');

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    console.log(`/start buyrug'i keldi: ${chatId}`);
    const firstName = msg.from.first_name;

    const welcomeMsg = `Salom ${firstName}! 😊\nFast Food botimizga xush kelibsiz.\nNima buyurtma berasiz?`;

    const menuKeys = Object.keys(menu);
    const menuButtons = [];
    for (let i = 0; i < menuKeys.length; i += 2) {
        menuButtons.push(menuKeys.slice(i, i + 2).map(item => ({ text: item })));
    }

    bot.sendMessage(chatId, welcomeMsg, {
        reply_markup: {
            keyboard: menuButtons,
            resize_keyboard: true,
            one_time_keyboard: true
        }
    }).catch(err => console.error(`Start xabari yuborishda xato:`, err.message));
});

bot.onText(/\/id/, (msg) => {
    bot.sendMessage(msg.chat.id, `Sizning Telegram ID: <code>${msg.chat.id}</code>`, { parse_mode: 'HTML' });
});

bot.onText(/\/testadmin/, (msg) => {
    const chatId = msg.chat.id;
    console.log(`Test admin buyrug'i keldi: ${chatId}. Admin ID: ${adminId}`);

    if (adminId) {
        bot.sendMessage(adminId, `🔔 Test xabari: Bot ishlamoqda! (Mijoz ID: ${chatId})`)
            .then(() => bot.sendMessage(chatId, "✅ Adminga test xabari yuborildi!"))
            .catch(err => {
                console.error("Test xabari yuborishda xatolik:", err.message);
                bot.sendMessage(chatId, "❌ Adminga xabar yuborib bo'lmadi: " + err.message);
            });
    } else {
        bot.sendMessage(chatId, "⚠️ .env faylida ADMIN_ID topilmadi!");
    }
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    console.log(`Xabar keldi: [${chatId}] ${text || '[media]'}`);

    if (text && (text === '/start' || text === '/id' || text === '/testadmin' || (typeof text === 'string' && text.startsWith('/ready')))) {
        return;
    }

    if (menu[text]) {
        userOrders[chatId] = {
            item: text,
            price: menu[text],
            status: 'waiting_location'
        };

        bot.sendMessage(chatId, `Siz tanladingiz: ${text}\n\nIltimos, yetkazib berish manzilini yuboring (pastdagi tugmani bosing). 📍`, {
            reply_markup: {
                keyboard: [
                    [{ text: "📍 Joylashuvni yuborish", request_location: true }],
                    [{ text: "❌ Buyurtmani bekor qilish" }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        }).catch(err => console.error(`Joylashuv so'rashda xato:`, err.message));
        return;
    }

    if (msg.location && userOrders[chatId] && userOrders[chatId].status === 'waiting_location') {
        userOrders[chatId].location = msg.location;
        userOrders[chatId].status = 'waiting_payment';

        const paymentMsg = `Manzil qabul qilindi. ✅\n\nNarxi: ${userOrders[chatId].price.toLocaleString()} so'm\n\nTo'lovni amalga oshirish uchun quyidagi karta raqamiga pul o'tkazing:\n\n💳 Karta: ${cardNumber}\n\nTo'lov qilgach, chekni (rasm yoki xabar) shu yerga yuboring.`;

        bot.sendMessage(chatId, paymentMsg, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Buyurtmani bekor qilish", callback_data: 'cancel_order' }]
                ],
                remove_keyboard: true
            }
        }).catch(err => console.error(`To'lov xabari yuborishda xato:`, err.message));
        return;
    }

    if (text === "❌ Buyurtmani bekor qilish" && userOrders[chatId]) {
        delete userOrders[chatId];
        const menuKeys = Object.keys(menu);
        const menuButtons = [];
        for (let i = 0; i < menuKeys.length; i += 2) {
            menuButtons.push(menuKeys.slice(i, i + 2).map(item => ({ text: item })));
        }
        bot.sendMessage(chatId, "Buyurtma bekor qilindi. Nima buyurtma berasiz?", {
            reply_markup: {
                keyboard: menuButtons,
                resize_keyboard: true,
                one_time_keyboard: true
            }
        });
        return;
    }

    if (userOrders[chatId] && userOrders[chatId].status === 'waiting_payment') {
        userOrders[chatId].status = 'pending_admin';

        bot.sendMessage(chatId, "Rahmat! Buyurtmangiz qabul qilindi. ✅\nAdministrator to'lovni tekshirib, buyurtma tayyor bo'lishi bilan sizga xabar beradi.");

        if (adminId) {
            const location = userOrders[chatId].location;
            const locationLink = location ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}` : 'Yuborilmagan';

            const orderDetails = `🆕 Yangi Buyurtma!\n\n👤 Mijoz: ${msg.from.first_name} ${msg.from.last_name || ''} (@${msg.from.username || 'username yo\'q'})\n🍔 Taom: ${userOrders[chatId].item}\n💰 Narxi: ${userOrders[chatId].price.toLocaleString()} so'm\n📍 Manzil: <a href="${locationLink}">Google Maps</a>\n🆔 Chat ID: <code>${chatId}</code>\n\nJavob yozish uchun ushbu xabarga <b>Reply</b> qilib yozing.`;

            bot.sendMessage(adminId, orderDetails, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "✅ Tayyor", callback_data: `ready_${chatId}` }]
                    ]
                }
            })
                .then(() => console.log(`Buyurtma xabari adminga yuborildi.`))
                .catch(err => console.error(`Admin (@${adminId}) ga xabar yuborishda xatolik:`, err.message));

            if (msg.photo) {
                bot.sendPhoto(adminId, msg.photo[msg.photo.length - 1].file_id, { caption: `To'lov cheki: ${msg.from.first_name}` })
                    .catch(err => console.error(`Admin (@${adminId}) ga rasm yuborishda xatolik:`, err.message));
            }
        } else {
            console.warn('ADMIN_ID .env faylida ko\'rsatilmagan!');
        }
    }
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === 'cancel_order') {
        if (userOrders[chatId]) {
            const orderStatus = userOrders[chatId].status;
            const item = userOrders[chatId].item;
            delete userOrders[chatId];
            bot.answerCallbackQuery(query.id, { text: "Buyurtma bekor qilindi." });
            const menuKeys = Object.keys(menu);
            const menuButtons = [];
            for (let i = 0; i < menuKeys.length; i += 2) {
                menuButtons.push(menuKeys.slice(i, i + 2).map(item => ({ text: item })));
            }

            bot.sendMessage(chatId, "❌ Buyurtmangiz bekor qilindi. Nima buyurtma berasiz?", {
                reply_markup: {
                    keyboard: menuButtons,
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
            if (orderStatus === 'pending_admin' && adminId) {
                bot.sendMessage(adminId, `⚠️ Mijoz buyurtmani bekor qildi!\n\n👤 Mijoz: ${query.from.first_name} (@${query.from.username || 'username yo\'q'})\n🍔 Taom: ${item}\n🆔 Chat ID: <code>${chatId}</code>`, { parse_mode: 'HTML' });
            }
        } else {
            bot.answerCallbackQuery(query.id, { text: "Bekor qilinadigan buyurtma topilmadi." });
        }
    }

    if (data.startsWith('ready_')) {
        const targetCustomerChatId = data.replace('ready_', '');
        const readyMsg = "Xushxabar! Sizning buyurtmangiz tayyor bo'ldi. 😋 Kelib olib ketishingiz yoki kuryerni kutishingiz mumkin.";

        bot.sendMessage(targetCustomerChatId, readyMsg)
            .then(() => {
                bot.answerCallbackQuery(query.id, { text: "Mijozga xabar yuborildi." });
                bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id });
                bot.sendMessage(chatId, `Mijozga (ID: ${targetCustomerChatId}) "Tayyor" xabari yuborildi. ✅`);
            })
            .catch((err) => {
                bot.answerCallbackQuery(query.id, { text: "Xatolik: " + err.message });
            });
    }
});

bot.onText(/\/ready (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (chatId.toString() !== adminId.toString()) return;

    const targetCustomerChatId = match[1];
    const readyMsg = "Xushxabar! Sizning buyurtmangiz tayyor bo'ldi. 😋 Kelib olib ketishingiz yoki kuryerni kutishingiz mumkin.";

    bot.sendMessage(targetCustomerChatId, readyMsg)
        .then(() => {
            bot.sendMessage(adminId, `Mijozga (ID: ${targetCustomerChatId}) "Tayyor" xabari yuborildi. ✅`);
        })
        .catch((err) => {
            bot.sendMessage(adminId, "Xatolik yuz berdi: " + err.message);
        });
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    // Admin Reply (Advanced logic)
    if (chatId.toString() === adminId.toString() && msg.reply_to_message) {
        let targetId = null;
        const replyText = msg.reply_to_message.text || msg.reply_to_message.caption || "";

        // E'lon yoki buyurtma xabaridan Chat ID ni qidiramiz
        const idMatch = replyText.match(/🆔 Chat ID: (\d+)/) || replyText.match(/\(Mijoz ID: (\d+)\)/);

        if (idMatch) {
            targetId = idMatch[1];
            const adminText = msg.text;

            if (adminText) {
                bot.sendMessage(targetId, `🔔 Administrator xabari:\n\n${adminText}`)
                    .then(() => bot.sendMessage(adminId, "✅ Xabaringiz mijozga yetkazildi."))
                    .catch(err => bot.sendMessage(adminId, "❌ Yuborishda xato: " + err.message));
            }
        }
    }
});