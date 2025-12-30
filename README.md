# Nanobanana Helper (Gemini)

[English](#english) | [日本語](#japanese)

---

<a name="english"></a>
## English

**Nanobanana Helper** is a Chrome Extension designed to automate the workflow of generating images using Google Gemini based on local Markdown files. It reads prompts from Markdown files, sends them to Gemini, detects generated images, and automatically downloads them.

### Features

- **Folder Selection**: Select a local folder containing Markdown (`.md`) files.
- **Auto-Processing Loop**: Automatically processes selected files one by one.
    - Pastes Markdown content into Gemini chat.
    - Activates "Create Image" tool efficiently.
    - Waits for generation to complete.
    - Automatically downloads full-size generated images.
    - Proceeds to the next file.
- **Encoding Support**: Automatically detects and handles UTF-8 and Shift-JIS encodings (preventing mojibake).
- **Duplicate Prevention**: Tracks downloaded images to avoid duplicates.
- **Progress Tracking**: Shows real-time progress in the side panel.

### Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **"Developer mode"** in the top right corner.
4. Click **"Load unpacked"** and select the extension directory.

### Usage

1. Open [Google Gemini](https://gemini.google.com/).
2. Click the extension icon to open the **Side Panel**.
3. Click **"Select Folder (.md Only)"** and choose a folder with your prompt files.
4. Select the files you want to process using the checkboxes.
5. Click **"▶ Start Auto"**.
6. The extension will handle the rest! Sit back and watch it work.

---

<a name="japanese"></a>
## 日本語

**Nanobanana Helper** は、ローカルのMarkdownファイルを元にGoogle Geminiで画像を生成するワークフローを自動化するためのChrome拡張機能です。Markdownファイルからプロンプトを読み込み、Geminiに送信し、生成された画像を検知して自動的にダウンロードします。

### 主な機能

- **フォルダ選択**: Markdown (`.md`) ファイルを含むローカルフォルダを選択できます。
- **自動処理ループ**: 選択したファイルを順次自動処理します。
    - Markdownの内容をGeminiチャットに貼り付け。
    - 「画像を作成」ツールを自動的に選択・有効化。
    - 生成完了を検知して待機。
    - 生成されたフルサイズ画像を自動ダウンロード。
    - 次のファイルへ自動的に進みます。
- **文字コード対応**: UTF-8 と Shift-JIS を自動判別し、文字化けを防ぎます。
- **重複防止**: ダウンロード済みの画像を追跡し、重複ダウンロードを回避します。
- **進捗表示**: サイドパネルで現在の処理状況をリアルタイムに確認できます。

### インストール方法

1. このリポジトリをクローンまたはダウンロードします。
2. Chromeを開き、`chrome://extensions/` にアクセスします。
3. 右上の **「デベロッパーモード」** をオンにします。
4. **「パッケージ化されていない拡張機能を読み込む」** をクリックし、この拡張機能のディレクトリを選択します。

### 使い方

1. [Google Gemini](https://gemini.google.com/) を開きます。
2. 拡張機能アイコンをクリックして **サイドパネル** を開きます。
3. **「Select Folder (.md Only)」** をクリックし、プロンプトファイルが入ったフォルダを選択します。
4. 処理したいファイルをチェックボックスで選択します。
5. **「▶ Start Auto」** をクリックします。
6. あとは自動的に処理が進むのを見守るだけです！
