import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"

const NAV_ITEMS = [
  { label: "Home", href: "/", isActive: true },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "About us", href: "#about" },
  { label: "Contact", href: "#contact" },
]

function Header() {
  return (
    <header className="py-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.svg"
            alt="Matryc"
            width={40}
            height={40}
            priority
            className="h-10 w-auto"
          />
          <span className="text-xl font-semibold tracking-tight text-transparent bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text">
            Matryc
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 rounded-full border border-neutral-200 bg-blue-500/10 p-1 shadow-sm">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.isActive ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                item.isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
          >
            Login
          </Link>
          <Link href="/sign-up">
            <Button className="h-11 rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-md hover:bg-blue-500">
              Sign Up
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}

export default Header