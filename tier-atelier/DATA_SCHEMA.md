# データ設計

## プロジェクト

`src/data/types.ts`を型定義として使用し、企画書の`schemaVersion: 1`を維持します。`id`、`title`、`description`、`createdAt`、`updatedAt`、`tiers`、`unrankedItemIds`、`items`、`assets`、`style`を持ちます。

IDは`crypto.randomUUID()`で作成します。表示名を変更してもIDは変わりません。Tierの順序は配列順、アイテムの順序は所属するID配列の順です。`items`はアイテムIDをキーとする辞書です。

各アイテムは必ず1つのTierまたは未分類に所属します。移動はImmerの1回の更新内で移動元から削除し、移動先へ追加します。存在しないID、不正な移動先、ロックへの操作はエラーとして扱い、元の状態を保持します。

Tierの削除では、所属するアイテムを未分類の末尾へ順序どおり追加します。Tier複製では新しいUUIDを発行し、`itemIds`を空にします。アイテム削除では配置と辞書エントリーを同じ更新内で削除します。

## Tier・アイテム・画像

Tierは`id`、`name`、`background`、`foreground`、`itemIds`と、任意の`minHeight`、`labelWidth`、`locked`を持ちます。`labelWidth`を省略すると共通のラベル幅を使います。折りたたみ状態は編集画面だけのUI状態であり、データや将来の出力除外設定には使いません。

アイテムは`id`、`assetId`、`name`、`description`、`tags`、`createdAt`を持ちます。文字アイテムでは`assetId`は`null`、画像アイテムでは素材IDを参照します。アイテム名とTier名は空白除去後1〜80文字、プロジェクト名は1〜120文字、説明は1,000文字以内、タグは1件30文字以内・最大20件です。同じタグは重複を除きます。色は6桁の16進数です。

画像メタデータは`id`、`blobKey`、`mimeType`、`width`、`height`、`originalName`を持ちます。元画像とサムネイルのBlobをIndexedDBへ分離して保存し、アイテムが素材を参照します。通常のプロジェクトデータへBase64画像を埋め込みません。JPEGの寸法はファイル内の元寸法を記録し、サムネイルはEXIFの向きを反映します。

## 保存・互換性

Dexieを使い、データベース`tier-atelier`のバージョン1に保存します。

| テーブル | キー・内容 |
| --- | --- |
| projects | `id`、`updatedAt`、`revision`、`project` |
| blobs | `id`、元画像の`blob`、サムネイルの`thumbnail` |
| settings | `key`、`value`。`activeProject`に前回のプロジェクトIDを記録 |

保存は直列に実行し、書き込み中の追加編集は次の保存へ引き継ぎます。プロジェクトと新しいBlobは同一トランザクションで保存します。容量不足などで失敗すると、一部だけ書き込まれた状態を残さず、画面の編集内容と画像を保持します。

書き込む前に`revision`を確認します。別のタブで更新または削除されていた場合は競合エラーとし、上書きしません。画像の削除前には全プロジェクトの参照を確認し、複製プロジェクトで使用中のBlobを残します。アイテム複製では`assetId`、プロジェクト複製では`blobKey`を共有します。

## JSONバックアップ

バックアップの外側の形式は次のとおりです。`project`は上記のProject、`blobs`にはそのプロジェクトから参照する元画像を1件ずつ含めます。サムネイルは復元時に再生成します。

```json
{
  "format": "tier-atelier",
  "backupVersion": 1,
  "project": { "schemaVersion": 1 },
  "blobs": [
    { "key": "BlobのID", "mimeType": "image/png", "dataBase64": "元画像のBase64" }
  ]
}
```

これは外側の構造を示す抜粋であり、`project`にはすべての必須フィールドが必要です。入出力の実装は`features/backup/backup.ts`にあります。

復元ではZodで型を検証し、IDの重複、辞書キーとIDの不一致、配置の重複・欠落、素材・Blob参照、MIME、Base64、実画像の寸法を確認します。画像をすべて読み込めた場合だけ、新規プロジェクトとBlobを一括保存します。既存のプロジェクトIDとBlobキーには書き込みません。

復元時はプロジェクトIDとBlobキーを新しく発行します。Tier・アイテム・素材のIDはプロジェクト内で管理するため維持します。プロジェクト、Tier、アイテム、素材、style内の未知のフィールドも保持します。

`migrateProject`を保存データの読み込みと復元の共通入口にしています。現在の対応形式は`schemaVersion: 1`だけです。未対応のバージョンは説明を表示して拒否します。保存形式を変更するフェーズでは、この入口へ変換処理と旧データのテストを追加します。

## デザイン設定の追加

フェーズ3は任意フィールドの追加で対応し、schemaVersion・backupVersion・IndexedDBのバージョンは1を維持します。旧データの読み込み時には既存キーを置換せず、表示時に不足する設定の既定値を補います。デザインを保存すると、新しい設定値も記録します。

`style`の既存キーは保持します。追加項目は次のとおりです。

| 対象 | キー |
| --- | --- |
| 背景 | `backgroundMode`、`backgroundAssetId`、`backgroundSecondary`、`gradientAngle`、`pattern` |
| 文字 | `textColor`、`fontSize`、`labelFontSize`、`cardTextColor` |
| 間隔 | `padding`、`rowGap` |
| 枠・カード | `borderWidth`、`borderStyle`、`cardBackground`、`shadow` |
| 見出し | `titleSize`、`titleAlign`、`titleDecoration` |

背景画像は`backgroundAssetId`から既存の`assets`を参照し、Blobの保存・共有・JSON同梱にはフェーズ2の処理を使います。背景を単色などへ切り替えても画像参照を残します。背景の削除・置換時には、アイテムとほかのプロジェクトからの参照がないBlobだけを削除します。

画像アイテムには任意の`crop`を追加します。`null`または省略は切り抜きなし、値がある場合は`{ x, y, width, height }`を0〜1の割合で保存します。幅・高さは0.01以上、左端＋幅と上端＋高さは1以内です。座標はEXIFの向きを反映した画像を基準とします。元のBlobと画像メタデータは変更せず、表示用Canvasだけを描画します。JSON復元でも範囲と画像参照を検証します。

テーマの全体適用では、既存の`style`へ外観設定を上書きし、背景画像参照と未知キーを保持します。ランクのみの適用は配色・共通ラベル幅・ラベル文字サイズ・Tier間隔、カードのみの適用は画像サイズ・カード間隔・角丸・表示方法・名前表示・文字サイズ・カード配色・枠・影を変更します。Tierの個別寸法は維持します。
