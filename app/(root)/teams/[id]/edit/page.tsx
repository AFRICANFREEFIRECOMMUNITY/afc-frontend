import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditTeamForm } from "./_components/EditTeamForm";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Params = Promise<{
  id: string;
}>;

export default async function EditTeamPage({ params }: { params: Params }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Button variant={"outline"} className="mb-4" asChild>
          <Link href={`/teams/${decodedId}`}>Go back</Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Edit Team: {decodedId}</CardTitle>
          </CardHeader>
          <CardContent>
            <EditTeamForm id={decodedId} />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
