# 開発計画

## 作業範囲

フェーズ6のPWA・オフライン対応まで実装しました。追加依頼により右上に更新情報・表示モード切替・Helpを実装し、GitHub Pagesへ公開しました。企画書原文は[original-proposal.txt](original-proposal.txt)に保持しています。原文の要件は削除せず、各フェーズのタスクを[TASKS.md](../TASKS.md)に整理しています。

同じリポジトリにある`character-attribute-maker/`は別アプリです。既存の変更、保存形式、操作を保持します。公開ワークフローは既存サイトをルートへ配置したまま、Reactアプリを`tier-atelier/`へ追加する構成に拡張します。

## フェーズ

| フェーズ | 実装内容 | 確認すること |
| --- | --- | --- |
| 1 | 基本UI、Tier編集、文字アイテム配置 | 配置の一意性、削除時の退避、ロック、PC・スマホ・キーボード操作 |
| 2 | 画像登録、プロジェクト管理、IndexedDB、JSON | 20枚以上の画像、再読込、画像込みの往復復元、異常ファイルと保存失敗 |
| 3 | 配色・背景・文字・サイズ、テーマ | テーマ適用で項目を失わないこと、表示と設定の一致 |
| 4 | PNG・JPEG・WebP、印刷・ファイル共有・軽量URL | 編集UI除外、透過、倍率、縦横比、長い表とCanvas上限 |
| 5 | Undo・Redo、検索、フィルター、一括操作、表示支援 | 履歴対象の網羅、操作の代替手段、大量アイテム |
| 6 | PWA、オフライン、公開前検証 | 保存済みプロジェクトのオフライン編集、更新、全機能回帰 |

各フェーズの終了時に型チェック、単体テスト、必要なブラウザ操作テスト、production buildを実施します。フェーズ1でも基本的なレスポンシブ表示、読み上げ名、フォーカス、タップ操作を実装し、フェーズ5で操作支援全体を仕上げます。

## 採用技術と互換性

2026年10月27日に公式ドキュメントとnpmレジストリのpeerDependenciesを確認しました。依存バージョンは`package.json`で完全固定し、`pnpm-lock.yaml`に解決結果を保存しています。

React 19.3.1、React DOM 19.3.1、Vite 8.3.5、@vitejs/plugin-react 6.1.2、Zustand 5.0.16、Immer 11.2.9、Zod 4.6.7、@dnd-kit/reactと@dnd-kit/dom 0.5.1を使用します。Vitestは5.0.5、Playwrightは1.64.1です。

TypeScript 7.0.2はtypescript-eslint 8.72.0の要求範囲`>=4.8.4 <6.1.0`に入らないため、TypeScript 6.0.3を採用しました。Node.js 24.19.0上でpeerDependenciesの不一致がないことを確認しています。

dnd-kitは現行のReact APIを採用します。[公式移行ガイド](https://dndkit.com/react/guides/migration/)で旧`@dnd-kit/core`との違いを確認しました。[Viteの実行環境要件](https://vite.dev/guide/)と[ZustandのImmer連携](https://zustand.docs.pmnd.rs/reference/integrations/immer-middleware)も確認しています。

フェーズ2ではDexie 4.4.7と、テスト用のfake-indexeddb 6.2.6を追加しました。現在のTypeScript・Node.jsとの組み合わせで型チェックと保存テストを実施しています。[Dexieの推奨事項](https://dexie.org/docs/Tutorial/Best-Practices)に従い、画像のデコードやBase64変換はIndexedDBトランザクションの前に終えます。

フェーズ3では依存ライブラリを追加・更新していません。背景やテーマはCSS、切り抜きプレビューはCanvasで表示し、既存の編集・検証・保存処理へ接続しています。

フェーズ6でvite-plugin-pwa 2.0.0、workbox-core・precaching・routing 7.4.1を追加しました。2026年10月28日にnpmレジストリでVite 8・Node.js 24との互換性を再確認し、strict-peer-dependencies付きで導入しています。injectManifest方式で静的ファイルを事前キャッシュし、更新前の保存と別タブの確認は独自のService Workerメッセージで処理します。[公式のinjectManifest仕様](https://vite-pwa-org.netlify.app/guide/inject-manifest.html)を参照しています。

フェーズ4ではCanvas 2Dを採用し、依存ライブラリを追加していません。企画書で候補にしたhtml-to-imageは、編集DOMの状態やサムネイルに出力が依存するため採用を見送りました。保存済みの設定と元画像を使う専用の描画処理で、編集ボタンの除外、折りたたんだ行の出力、切り抜きと高倍率に対応します。出力パネルは遅延読み込みにしています。

フォントは[FontFaceSet.ready](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/ready)と必要な書体の読み込み完了を待ちます。[Canvas.toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)は未対応形式でPNGを返す場合があるため、生成BlobのMIMEも確認します。[Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)には、事前に生成したファイルをボタン操作から直接渡します。これらの仕様は2026年10月27日に確認しました。

## 実装の分担

`features/editor/commands.ts`は画面から独立した編集処理です。入力をZodで検証し、Immerでプロジェクトを更新します。`stores/editorStore.ts`は選択対象、未保存状態、利用者向けエラーを管理します。UIコンポーネントからは共通の編集コマンドを呼び出します。

ドラッグは完了時に1回だけ編集コマンドを実行します。キャンセル時にはデータを変更しません。移動中の要素は自分自身のドロップ先として扱いません。タッチは長押し、マウスは移動距離を開始条件にし、ドラッグハンドル以外では通常どおりスクロールできます。

自動保存は`features/storage/session.ts`、永続化のトランザクションは`data/db.ts`で管理します。保存中の再編集、別タブとの競合、失敗後の再試行とバックアップを扱います。画像処理とバックアップ処理はそれぞれ独立した機能フォルダーに分けています。

フェーズ5の履歴は`features/editor/history.ts`でImmer差分を最大100操作保持します。編集コマンドと画像の一括登録・背景登録を同じ履歴処理へ接続しました。Blobは別のMapで共有し、履歴から戻せる間はメモリに残します。IndexedDBから削除済みならUndoの保存と同時に復元します。

未分類の表示対象が100件以上の場合は、列数・行高・スクロール位置から描画範囲を計算します。前後2行とフォーカス中・ドラッグ中の項目を追加して描画し、矢印キーなどによる範囲外への移動にも対応します。列数はResizeObserverで更新し、名前には2行分の高さを確保します。dnd-kitのDragOverlayを使い、元の項目がスクロール領域外へ移動してもドラッグ表示を続けます。

既存のImmer・dnd-kitとブラウザ標準機能で実装できるため、フェーズ5でも依存ライブラリは追加していません。[Immerの差分履歴](https://immerjs.github.io/immer/patches/)と[dnd-kitのDragOverlay](https://dndkit.com/react/components/drag-overlay/)の仕様を確認し、型チェックと操作テストで現在のバージョンとの互換性を検証しています。

## 現段階の制限

フェーズ6のPWA・オフライン編集まで提供しています。iPhone・Android実機とスクリーンリーダー、実際のインストール画面・OS共有・プリンター、公開先での配置確認は未完了です。Windows版WebKit・Firefoxの環境制約も含め、[検証記録](verification-phase6.md)とTASKSに残しています。
