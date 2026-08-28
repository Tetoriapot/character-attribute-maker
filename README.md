# キャラ属性メーカー

画像をドラッグして自由な二軸マップを作り、編集用UIを含まないPNGとして保存できる静的Webサイトです。フレームワーク、ビルド処理、サーバー処理、外部ライブラリは使用していません。

サイト本体は [`character-attribute-maker/`](character-attribute-maker/) にあります。

## 主な機能

- 図のタイトルと上下左右の軸ラベルを自由に設定し、図の内側／外側へ切り替え
- 外側レイアウトでは左右の評価語を縦書き／横書きから選択
- 複数のPNG・JPEG・WebP画像をアップロードして配置
- アップロード画像を複数選択、または一括で削除（配置済み画像も連動・Undo対応）
- ドラッグ移動、サイズ変更、複製、削除、名前表示、枠と形状の設定
- 選択中のサイズ・枠・形状・名前表示を、配置中の全画像へ一括適用
- 図の内側／外側で背景を分け、単色・2色グラデーション・画像・透過を切り替え
- 内側背景だけの不透明度を調整
- 軸線の単色・2色グラデーションと矢印の長さを調整
- 日本語向け10種類のフォントを選択
- Undo／Redoとキーボード操作
- 最大2400×2400 pxのPNG出力
- PC・スマートフォン対応

詳しい操作方法は [`character-attribute-maker/README.md`](character-attribute-maker/README.md) を参照してください。

## ローカルで開く

インストールは不要です。`character-attribute-maker/index.html` をブラウザで開くだけで動作します。

## GitHub Pagesで全体公開する

このリポジトリには、`main` ブランチへの更新時に `character-attribute-maker/` をGitHub Pagesへ自動公開するワークフローが含まれています。

1. GitHubで新しいリポジトリを作成し、公開範囲を **Public** にします。
2. このフォルダーの内容を `main` ブランチへpushします。
3. GitHubのリポジトリで **Settings → Pages** を開きます。
4. **Build and deployment → Source** で **GitHub Actions** を選択します。
5. **Actions** の「Deploy to GitHub Pages」が完了すると公開URLが表示されます。

以後は `main` ブランチへ更新をpushするたびに、自動で再公開されます。公開対象はサイト本体のフォルダーだけで、`.agents/`、`.codex/`、ローカルログなどは公開物へ含まれません。

## プライバシー

- アップロードした画像や配置内容はブラウザ内だけで処理され、外部サーバーへ送信されません。
- 画像と配置内容はページを閉じると失われます。閉じる前にPNGで保存してください。
- タイトル、軸ラベル、色、フォントなど一部の表示設定だけを同じブラウザのLocalStorageへ保存します。
- 公開ページへの通常のアクセス情報はGitHub Pages側で扱われる場合があります。TeToriapotへ移動した後は、リンク先の方針が適用されます。

## お問い合わせ

ご意見・ご質問・不具合のご連絡は、[TeToriapot](https://tetoriapot.sakura.ne.jp/index.html) からお願いします。GitHubの新規Issue画面にも同じ問い合わせ先を表示する設定です。

## リポジトリ構成

```text
相関図ツール/
├─ .github/
│  ├─ ISSUE_TEMPLATE/config.yml  # GitHub上の問い合わせ案内
│  └─ workflows/pages.yml        # GitHub Pages自動公開
├─ .gitignore                    # 公開不要なローカルファイルを除外
├─ README.md                     # リポジトリ案内
└─ character-attribute-maker/
   ├─ index.html
   ├─ style.css
   ├─ script.js
   └─ README.md
```

## ライセンス

現時点ではライセンスを設定していません。第三者による利用・改変・再配布を許可する場合は、公開方針に合うライセンスを選んで `LICENSE` を追加してください。
