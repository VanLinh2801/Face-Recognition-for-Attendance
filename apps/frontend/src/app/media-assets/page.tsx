import { PageHeader } from "@/components/data/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { listMediaAssets } from "@/lib/mock-repository";
import { formatDateTime } from "@/lib/utils";

export default function MediaAssetsPage() {
  const assets = listMediaAssets().items;

  return (
    <div>
      <PageHeader title="Media Assets" description="Danh sách object media theo contract media-assets." />
      <div className="space-y-4 p-6">
        <Card><CardContent><Select defaultValue="all"><option value="all">Tất cả asset type</option><option value="registration_face">registration_face</option><option value="unknown_snapshot">unknown_snapshot</option><option value="spoof_snapshot">spoof_snapshot</option><option value="face_crop">face_crop</option></Select></CardContent></Card>
        <Card>
          <CardHeader><CardTitle>Assets</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr className="border-b border-slate-200"><th className="py-3">Filename</th><th>Type</th><th>Bucket</th><th>Object key</th><th>MIME</th><th>Size</th><th>Created</th></tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id} className="border-b border-slate-100">
                      <td className="py-3 font-medium">{asset.original_filename}</td>
                      <td><Badge variant="info">{asset.asset_type}</Badge></td>
                      <td>{asset.bucket_name}</td>
                      <td className="font-mono text-xs text-slate-500">{asset.object_key}</td>
                      <td>{asset.mime_type}</td>
                      <td>{Math.round(asset.file_size / 1024)} KB</td>
                      <td className="font-mono text-xs text-slate-500">{formatDateTime(asset.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
