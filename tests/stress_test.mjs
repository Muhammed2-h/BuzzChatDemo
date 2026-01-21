
const BASE_URL = 'http://localhost:3000';
const ROOM_ID = `stress-test-${Date.now()}`; // Unique Room ID
const PASSKEY = '123';
const ADMIN_CODE = 'admin123';

const USERS_COUNT = 50;
const DURATION_MS = 30000; // 30 seconds run
const POLL_INTERVAL = 1000;
const SEND_INTERVAL = 3000;

let activeUsers = [];
let errors = 0;
let messagesSent = 0;
let refreshCount = 0;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Mimic the browser's behavior
async function joinUser(username, storedCreds = null) {
    try {
        const payload = {
            roomId: ROOM_ID,
            passkey: PASSKEY,
            username: username,
            // If refreshing, we use stored token/adminCode
            sessionToken: storedCreds?.sessionToken || undefined,
            adminCode: storedCreds?.adminCode || (username === 'User-1' ? ADMIN_CODE : undefined)
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

        return {
            username,
            sessionToken: data.sessionToken,
            adminCode: payload.adminCode,
            lastTimestamp: storedCreds?.lastTimestamp || 0
        };
    } catch (e) {
        console.error(`[${username}] Join Error:`, e.message);
        errors++;
        return null;
    }
}

async function leaveUser(user) {
    try {
        // Mimic beforeunload 'leave'
        // explicit: false is key here
        const payload = JSON.stringify({ roomId: ROOM_ID, passkey: PASSKEY, username: user.username, explicit: false });
        await fetch(`${BASE_URL}/api/leave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload
        });
    } catch (e) {
        // Ignore leave errors, beacon is fire-and-forget
    }
}

async function poll(user) {
    if (user.isRefeshing) return;
    try {
        const url = `${BASE_URL}/api/poll?roomId=${ROOM_ID}&passkey=${PASSKEY}&username=${user.username}&since=${user.lastTimestamp}`;
        const res = await fetch(url);

        if (!res.ok) {
            // If 403/401, in a real browser it would trigger auto-rejoin.
            // But here we count it as a "momentary drop" unless we are simulating refresh.
            if (res.status === 401 && !user.isRefeshing) {
                // console.log(`[${user.username}] 401 during poll (expected if just refreshed)`);
            } else {
                console.error(`[${user.username}] Poll Failed: ${res.status}`);
                errors++;
            }
            return;
        }

        const data = await res.json();
        if (data.success && data.messages.length > 0) {
            user.lastTimestamp = data.messages[data.messages.length - 1].timestamp;
        }
    } catch (e) {
        if (!user.isRefeshing) {
            console.error(`[${user.username}] Poll Error:`, e.message);
            errors++;
        }
    }
}

async function sendMessage(user) {
    if (user.isRefeshing) return;
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
        // Ignore 401s during refresh cycles
        else if (res.status !== 401) {
            console.error(`[${user.username}] Send Failed: ${res.status}`);
            errors++;
        }
    } catch (e) {
        // Ignore
    }
}

async function simulateRefresh(user) {
    if (user.isRefeshing) return;
    user.isRefeshing = true;
    refreshCount++;

    // 1. Stop Polling (Clear Interval not needed, we just gate with isRefeshing)

    // 2. Send Leave (beforeunload)
    await leaveUser(user);

    // 3. Wait (Page Reload time)
    await sleep(Math.random() * 1000 + 500);

    // 4. Auto-Rejoin
    // This is the CRITICAL STEP: We act as if the browser loaded and found creds in localStorage
    const newUser = await joinUser(user.username, {
        sessionToken: user.sessionToken,
        adminCode: user.adminCode
    });

    if (newUser) {
        // Success! We are back in.
        user.sessionToken = newUser.sessionToken;
        user.isRefeshing = false;
    } else {
        console.error(`[${user.username}] FAILED TO REJOIN AFTER REFRESH`);
        errors++;
        // Stop invalid user
        clearInterval(user.pollInterval);
        clearInterval(user.sendInterval);
        clearInterval(user.refreshInterval);
    }
}

async function run() {
    console.log(`Starting Chaos Test with ${USERS_COUNT} users in room ${ROOM_ID}...`);

    // 1. Mass Join
    for (let i = 1; i <= USERS_COUNT; i++) {
        const u = await joinUser(`User-${i}`);
        if (u) {
            u.pollInterval = setInterval(() => poll(u), POLL_INTERVAL);
            u.sendInterval = setInterval(() => {
                if (Math.random() > 0.8) sendMessage(u);
            }, SEND_INTERVAL);

            // Randomly refresh every ~5-10s
            u.refreshInterval = setInterval(() => {
                if (Math.random() > 0.6) simulateRefresh(u);
            }, 5000 + Math.random() * 5000);

            activeUsers.push(u);
        }
        if (i % 10 === 0) console.log(`${i} users joined...`);
        // Slight stagger to avoid instant network spike
        await sleep(50);
    }

    console.log("All users active. Simulation running...");

    // Run for duration
    await sleep(DURATION_MS);

    console.log("--- STOPPING TEST ---");
    activeUsers.forEach(u => {
        clearInterval(u.pollInterval);
        clearInterval(u.sendInterval);
        clearInterval(u.refreshInterval);
    });

    console.log(`Summary:`);
    console.log(`Total Users: ${activeUsers.length}`);
    console.log(`Total Messages Sent: ${messagesSent}`);
    console.log(`Total Refreshes Simulated: ${refreshCount}`);
    console.log(`Total Errors: ${errors}`);
    process.exit(0);
}

run();
