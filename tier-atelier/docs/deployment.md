# 静的サイトの公開・更新手順

配信するのは`pnpm build`で生成される`dist/`の中身です。Node.jsはビルド時だけ必要で、公開先にはAPIサーバーやデータベースを設置しません。画像と編集内容は利用者のブラウザに保存します。

## 公開物の作成

`tier-atelier/`で次を実行します。

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e --workers=2
pnpm test:pwa
pnpm build
pnpm preview
```

`dist/`には`index.html`、`manifest.webmanifest`、`sw.js`、`assets/`、アイコンを含めます。`src/`、`node_modules/`、`.qa/`、バックアップJSON、利用者の画像はアップロードしません。ビルド一式を公開日・コミットと対応づけて保管すると、以前の版へ戻せます。

ルート配置と`/tier-atelier/`のようなサブディレクトリ配置に対応しています。公開URLの末尾には`/`を付けます。サーバーもディレクトリURLを末尾`/`へリダイレクトする設定にします。Manifest・Service Worker・画像などは相対URLで参照します。存在しないJavaScriptファイルに`index.html`を返すSPA用リライトは設定しません。

PWAにはHTTPSが必要です。ローカルのlocalhost・127.0.0.1でも検証できます。公開先のURLへ移ると、開発用ブラウザの保存内容は自動では移りません。移行前にJSONバックアップを作り、公開先で復元します。ドメイン・ポート・HTTP/HTTPSが変わる場合も同様です。

## GitHub Pages

このリポジトリの`.github/workflows/pages.yml`は、現在`character-attribute-maker/`だけを公開しています。フェーズ6ではこの設定を変更していません。

併設用の設定例を[github-pages.yml](deployment/github-pages.yml)に用意しました。キャラ属性メーカーを既存のルートへ置き、TIER ATELIERをその下の`tier-atelier/`へ追加する構成です。このファイルは`docs/`内にあるため自動実行されません。

1. 公開を始めるときに、既存の`pages.yml`を保管し、設定例の内容へ変更します。同じPagesへ別々のワークフローから配信すると公開物が置き換わるため、既存サイトとまとめて1回で配信します。
2. GitHubのSettings → PagesでSourceをGitHub Actionsにします。公開用ブランチとEnvironmentの制限を確認します。
3. 初回はmainへ反映後、Actionsの「Deploy tools to GitHub Pages」を手動実行します。設定例は`workflow_dispatch`だけを使い、pushによる自動公開は有効にしていません。
4. ジョブに表示される公開URLでキャラ属性メーカーを確認し、そのURLの末尾に`tier-atelier/`を付けてTIER ATELIERを開きます。リポジトリ名がURLに含まれる場合も、その配下です。

設定例では公開前に型チェック・lint・単体テスト・ブラウザ回帰・PWAテスト・ビルドを実行します。GitHub Actions上での実行はまだ行っていません。権限とPages用アクションは[GitHub公式のカスタムワークフロー手順](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)に基づいています。

TIER ATELIERだけを別のリポジトリへ公開する場合は、ビルドの作業ディレクトリをその構成に合わせ、アップロード対象を`dist/`にします。既存サイトと同じURLへ単独の`dist/`を配信すると既存サイトを置き換えるため、公開先を確認してください。

## さくらのレンタルサーバ

1. サーバーコントロールパネルで、公開するドメインとドキュメントルートを確認します。独自ドメインは[無料SSLの設定手順](https://help.sakura.ad.jp/rs/2153/)に従ってHTTPSを有効にします。初期ドメインなどは同ページにある共有SSLの案内を確認します。
2. [ファイルマネージャー](https://help.sakura.ad.jp/rs/2195/)または契約プランで使えるファイル転送方法で、対象の公開フォルダーを開きます。例えばドキュメントルートが`www/`なら、その中の`tier-atelier/`を使用します。既存のトップページや別アプリを上書きしない配置先を選びます。
3. そのフォルダーへ`dist/`の中身をアップロードします。`dist`フォルダーを1段追加する構成ではありません。`assets/`内を含む全ファイルを転送します。
4. `https://対象ドメイン/tier-atelier/`を開き、下記の公開後確認を行います。

Apacheで`.htaccess`を使用できる場合の設定例を[apache.htaccess](deployment/apache.htaccess)に用意しています。配置先アプリのフォルダー内へ`.htaccess`として置きます。既存の同名ファイルがある場合は内容を統合し、認証やリダイレクト設定を消さないでください。実サーバーの設定は未検証です。

## 更新と復旧

更新前に、前回の公開物一式を保管します。ディレクトリやリリース単位で一括切り替えできる公開方法を優先してください。ファイルを順次上書きする場合は、ハッシュ付きの`assets/`とアイコンを先に転送し、次に`index.html`・Manifest、最後に`sw.js`を配置します。転送途中に旧版を使うタブが残るため、過去のハッシュ付きファイルをすぐに削除しないでください。

新しいService Workerは静的ファイルを取得できた場合にだけ更新待ちになります。途中で取得に失敗した場合は旧版を保持します。利用者には更新通知を表示し、「保存して更新」で保存を完了させてから切り替えます。旧版のタブをすべて閉じた場合は、ブラウザ標準の動作により次回起動時に新版を使います。起動し直した際には履歴が残りません。

HTTPキャッシュを設定できるサーバーでは、`sw.js`・`index.html`・`manifest.webmanifest`を`Cache-Control: no-cache`とし、ハッシュ付き`assets/`は長期キャッシュにできます。Service Workerの登録は`updateViaCache: none`を指定しています。GitHub Pagesの配信ヘッダーはサービス側で管理されます。

不具合があれば以前の公開物一式へ戻します。順次転送では同じく`sw.js`を最後に戻し、アプリの「更新を確認する」から旧版へ切り替えます。ブラウザのサイトデータやIndexedDBを削除する復旧方法は使いません。フェーズ6では保存形式を変更していませんが、今後保存形式が変わる場合は戻す版の互換性も確認してください。

## 公開後の確認

公開先で次の一連の操作を行います。今回の自動テストはローカルの本番ビルドを対象としており、公開先での確認は未実施です。

1. HTTPS、JavaScript・Manifest・Service Workerの応答、コンソールにエラーがないことを確認します。「アプリ・オフライン」で準備完了を確認します。
2. 画像を20枚以上登録し、Tier移動とデザイン変更を保存します。JSONをダウンロードして復元し、画像と編集内容を確認します。
3. 通信を切って再読み込みし、画像追加、編集、Undo・Redo、PNG・JPEG・WebP出力を行います。新しいタブでも同じURLを開きます。
4. 通信を戻して新版を配信し、更新通知、未適用入力・別タブでの保護、保存後の更新、データ保持を確認します。
5. PCと実際のiPhone・Androidで画面・タッチ操作・ホーム画面への追加を確認します。
