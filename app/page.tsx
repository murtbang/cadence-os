import dynamic from 'next/dynamic';

// ViewRouter decides between the Tablet view (today's HomeClient, untouched)
// and the new Mobile view. Kept client-only (ssr: false) just like before.
const ViewRouter = dynamic(() => import('@/components/ViewRouter'), { ssr: false });

export default function Page() {
  return <ViewRouter />;
}
