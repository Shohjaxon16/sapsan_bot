require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const adminId = process.env.ADMIN_ID;
const cardNumber = process.env.CARD_NUMBER || '8600000000000000';

const bot = new TelegramBot(token, { polling: true });

const userOrders = {};

const menu = {
    '🌯 Lavash-klassika': 18000,
    '🥙 Lavash-pishloqli': 20000,
    '🌭 Hot-dog': 20000,
    '🥖 Hot-dog-klassika': 15000,
    '🧀 Hot-dog-pishloqli': 22000,
    '🌮 Non-kabob': 13000,
    '🥤 Coca-Cola': 12000,
    '🥤 Fanta': 12000,
    '🥤 Sprite': 12000,
    '☕️ Choy': 5000,
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

            const orderDetails = `🆕 Yangi Buyurtma!\n\n👤 Mijoz: ${msg.from.first_name} ${msg.from.last_name || ''} (@${msg.from.username || 'username yo\'q'})\n🍔 Taom: ${userOrders[chatId].item}\n💰 Narxi: ${userOrders[chatId].price.toLocaleString()} so'm\n📍 Manzil: <a href="${locationLink}">Google Maps</a>\n🆔 Chat ID: <code>${chatId}</code>\n\nJavob yozish uchun:\n1. <b>Tayyor:</b> /ready ${chatId}\n2. <b>Sizning xabaringiz:</b> /msg ${chatId} [xabar matni]`;

            bot.sendMessage(adminId, orderDetails, { parse_mode: 'HTML' })
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

bot.onText(/\/msg (\d+) (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (chatId.toString() !== adminId.toString()) return;

    const targetCustomerChatId = match[1];
    const customText = match[2];

    bot.sendMessage(targetCustomerChatId, `🔔 Administrator xabari: \n\n${customText}`)
        .then(() => {
            bot.sendMessage(adminId, `Mijozga (ID: ${targetCustomerChatId}) xabar yuborildi. ✅`);
        })
        .catch((err) => {
            bot.sendMessage(adminId, "Xabar yuborishda xatolik: " + err.message);
        });
});
