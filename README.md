# Smart Renamer

A beautiful, high-performance desktop application for batch renaming files with smart rules. Built with Electron and a bold Brutalist aesthetic.

![Screenshot Placeholder](build/icon.png)

## ✨ Features

-   **Batch Renaming:** Rename hundreds of files in seconds.
-   **Smart Rules:**
    -   Replace underscores with spaces.
    -   Remove specific keywords.
    -   Smart capitalization (Title Case, Sentence Case, UPPERCASE, lowercase).
-   **Live Preview:** See exactly how your files will be renamed before applying changes.
-   **Conflict Detection:** Automatically warns you about duplicate filenames.
-   **Undo Support:** Made a mistake? Undo your last rename operation with a single click.
-   **Brutalist Design:** A unique, high-contrast UI with Light and Dark mode support.
-   **Drag & Drop:** Easily add files by dragging them into the app.

## 🚀 Tech Stack

-   **Core:** [Electron](https://www.electronjs.org/)
-   **Frontend:** HTML5, Vanilla CSS, JavaScript
-   **Styling:** Brutalist aesthetic with high-contrast tokens and snappy transitions.
-   **Typography:** JetBrains Mono & Unbounded (via Google Fonts)

## 🛠️ Installation & Development

### Prerequisites

-   [Node.js](https://nodejs.org/) (v16.x or higher recommended)
-   npm (comes with Node.js)

### Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/sonnybardhan/smartRenamer.git
    cd smart-renamer
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run the app in development mode:
    ```bash
    npm start
    ```

## 📦 Building and Distribution

To package the application for production:

```bash
# General build
npm run build

# To generate installers (dist)
npm run dist
```

Output will be located in the `dist/` directory.

## 📄 License

This project is licensed under the MIT License - see the [package.json](package.json) file for details.

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

---

Built with ❤️ by Sonny Bardhan
