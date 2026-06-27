import { Link } from '@/components/ui/link';
import { ExternalLink, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/** Not rendered yet — import in dashboard/page.tsx when mobile beta is ready. */
export function MobileAppCard() {
  return (
    <div className="grid gap-6 md:grid-cols-1">
      <Card className="col-span-1">
        <CardHeader className="pb-2">
          <CardTitle>Note Companion Mobile</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 flex items-center justify-center rounded-full bg-blue-50">
              <Smartphone className="h-8 w-8 text-blue-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Now in Beta</h3>
              <p className="text-sm text-muted-foreground">
                The Note Companion mobile app is now available for iOS. Capture
                notes, screenshots, and sync them directly to your vault with
                ease.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                  iOS
                </Badge>
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                  Share Extension
                </Badge>
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  Instant Sync
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-0">
          <Button className="w-full" size="sm" asChild>
            <Link href="https://discord.gg/udQnCRFyus" target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              Join early access through discord
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
