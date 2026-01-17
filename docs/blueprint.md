# **App Name**: Passkey Chat

## Core Features:

- Room Creation with Passkey: Allow users to create chat rooms and set a mandatory passkey for access.
- Passkey Authentication: Implement a passkey authentication mechanism that validates the provided passkey against the room's passkey before allowing access.
- Message Input Control: Disable message input until the user has successfully authenticated with the correct passkey.  After validation, the chat input enables for text entering and submitting
- Secure Message Polling: Modify the `/poll` endpoint to require the `roomId` and `passkey` for retrieving messages, ensuring that only authenticated users can access the content.
- Authenticated Message Sending: Modify the `/send` endpoint to require the `roomId` and `passkey` for sending messages, ensuring that only authenticated users can send messages.

## Style Guidelines:

- Primary color: Dark grayish-blue (#4A6572) for a subdued and secure feel, inspired by the request for a stealthy application.
- Background color: Very light grayish-blue (#F0F4F7), a lighter shade of the primary for contrast.
- Accent color: Muted green (#84A594), analogous to the primary, to highlight interactive elements and actions subtly.
- Body and headline font: 'Inter' (sans-serif) for a modern, objective feel.
- Maintain the existing layout and UI elements as per the request, ensuring minimal changes to the original design.