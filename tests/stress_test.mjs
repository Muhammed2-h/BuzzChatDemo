
const BASE_URL = 'http://localhost:3000';
const ROOM_ID = 'stress-test-room';
const PASSKEY = '123';
const ADMIN_CODE = 'admin123';

const USERS_COUNT = 10;
const DURATION_MS = 20000; // 20 seconds run
const POLL_INTERVAL = 1000;
const SEND_INTERVAL = 2500;

let activeUsers = [];
let errors = 0;
let messagesSent = 0;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function joinUser(username, isAdminConfig = false) {
    try {
        const payload = {
            roomId: ROOM_ID,
            passkey: PASSKEY,
            username: username,
            adminCode: isAdminConfig ? ADMIN_CODE : undefined
        };

        const res = await fetch(`${BASE_URL}/api/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            console.error(`[${username}] Join Failed:`, data.error || res.statusText);
            errors++;
            return null;
        }

        console.log(`[${username}] Joined. Token: ${data.sessionToken.substring(0, 5)}...`);
        return { username, sessionToken: data.sessionToken, lastTimestamp: 0 };
    } catch (e) {
        console.error(`[${username}] Join Error:`, e.message);
        errors++;
        return null;
    }
}

async function poll(user) {
    try {
        const url = `${BASE_URL}/api/poll?roomId=${ROOM_ID}&passkey=${PASSKEY}&username=${user.username}&since=${user.lastTimestamp}`;
        const res = await fetch(url);

        if (!res.ok) {
            console.error(`[${user.username}] Poll Failed: ${res.status}`);
            errors++;
            return;
        }

        const data = await res.json();
        if (data.success && data.messages.length > 0) {
            user.lastTimestamp = data.messages[data.messages.length - 1].timestamp;
            // console.log(`[${user.username}] Received ${data.messages.length} new msgs`);
        }
    } catch (e) {
        console.error(`[${user.username}] Poll Error:`, e.message);
        errors++;
    }
}

async function sendMessage(user) {
    try {
        const text = `Msg from ${user.username} at ${Date.now()}`;
        const res = await fetch(`${BASE_URL}/api/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomId: ROOM_ID,
                passkey: PASSKEY,
                user: user.username,
                text: text
            })
        });

        if (res.ok) messagesSent++;
        else {
            console.error(`[${user.username}] Send Failed: ${res.status}`);
            errors++;
        }
    } catch (e) {
        console.error(`[${user.username}] Send Error:`, e.message);
        errors++;
    }
}

async function run() {
    console.log("Starting Stress Test...");

    // 1. Create User 1 (Admin/Creator) to init room
    const admin = await joinUser('User-1', true);
    if (admin) activeUsers.push(admin);

    await sleep(1000);

    // 2. Create remaining 9 users
    for (let i = 2; i <= USERS_COUNT; i++) {
        const u = await joinUser(`User-${i}`);
        if (u) activeUsers.push(u);
        await sleep(200); // Stagger joins slightly
    }

    console.log(`Initial swarm joined: ${activeUsers.length} users.`);

    // 3. Start Loops
    activeUsers.forEach(u => {
        u.pollInterval = setInterval(() => poll(u), POLL_INTERVAL);
        u.sendInterval = setInterval(() => {
            if (Math.random() > 0.3) sendMessage(u);
        }, SEND_INTERVAL);
    });

    console.log("Activity loop running...");

    // 4. Mid-stream join (User 11)
    setTimeout(async () => {
        console.log("--- ADDING USER 11 ---");
        const u11 = await joinUser('User-11');
        if (u11) {
            u11.pollInterval = setInterval(() => poll(u11), POLL_INTERVAL);
            u11.sendInterval = setInterval(() => sendMessage(u11), SEND_INTERVAL);
            activeUsers.push(u11);
        }
    }, 10000);

    // 5. End
    setTimeout(() => {
        console.log("--- STOPPING TEST ---");
        activeUsers.forEach(u => {
            clearInterval(u.pollInterval);
            clearInterval(u.sendInterval);
        });
        console.log(`Summary:`);
        console.log(`Total Active Users: ${activeUsers.length}`);
        console.log(`Total Messages Sent: ${messagesSent}`);
        console.log(`Total Errors: ${errors}`);
        process.exit(0);
    }, DURATION_MS);
}

run();
