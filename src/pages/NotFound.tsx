import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-400">
        Error 404
      </p>
      <h1 className="mt-5 text-5xl font-semibold tracking-tight text-neutral-900">
        This page doesn't exist
      </h1>
      <p className="mt-4 max-w-md text-sm leading-7 text-neutral-500">
        The page you're looking for was moved, renamed or never existed. Let's
        get you back to the catalogue.
      </p>
      <Button asChild className="mt-8 rounded-full px-7">
        <Link to="/">Back to Staple</Link>
      </Button>
    </div>
  );
}
