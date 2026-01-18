# Buzz Chat

A simple, secure, and private passkey-based chat application built with Next.js is a React framework for building full-stack web applications. You use React components to build user interfaces, and Next.js for additional features and optimizations.

Under the hood, Next.js also abstracts and automatically configures tooling needed for React, like bundling, compiling, and more. This allows you to focus on building your application instead of spending time with configuration.

## Features

- **Room Creation**: Create unique chat rooms on the fly.
- **Passkey Protection**: Secure your room with a custom passkey. Only users with the correct passkey can join and view messages.
- **Real-time-ish Messaging**: Polling-based architecture for simple, serverless-friendly communication.
- **Ephemeral**: Rooms are in-memory and reset when the server restarts.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm (comes with Node.js)

## Getting Started

1.  **Clone the repository** (if you haven't already):
    ```bash
    git clone https://github.com/Muhammed2-h/Buzz_Chat.git
    cd buzz-chat
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run the development server**:
    ```bash
    npm run dev
    ```

4.  **Open the application**:
    Open [http://localhost:3000](http://localhost:3000) with your browser.

## Building for Production

To build the application for production usage:

1.  **Build the project**:
    ```bash
    npm run build
    ```

2.  **Start the production server**:
    ```bash
    npm start
    ```

## Technology Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Icons**: Lucide React

## License

MIT
