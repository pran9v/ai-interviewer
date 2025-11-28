"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useLayoutEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { animate, motion, useMotionValue, useTransform } from "motion/react"

function Hero() {
  const typingWord = "Interview"
  const measureRef = useRef<HTMLSpanElement>(null)
  const [wordWidth, setWordWidth] = useState(0)

  useLayoutEffect(() => {
    if (!measureRef.current) return

    const element = measureRef.current
    const updateSize = () => {
      setWordWidth(element.offsetWidth)
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  const progress = useMotionValue(0)

  useEffect(() => {
    const controls = animate(progress, [0, 1, 1, 0], {
      duration: 3.2,
      ease: [0.45, 0, 0.55, 1],
      times: [0, 0.45, 0.7, 1],
      repeat: Infinity,
      repeatDelay: 1,
    })

    return () => controls.stop()
  }, [progress])

  const typedWidth = useTransform(progress, (value) => value * wordWidth)
  const caretTranslate = useTransform(progress, (value) => value * wordWidth)

  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center px-4 pb-16 pt-10 text-center sm:px-6 sm:pb-24 sm:pt-16">
      <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
        Easy{" "}
        <span className="relative inline-block">
          <span
            className="relative inline-flex items-center overflow-hidden rounded-xl bg-blue-100 px-4 py-1 text-blue-600"
            style={{
              width: wordWidth ? wordWidth + 32 : undefined,
            }}
          >
            <motion.span
              style={{ width: typedWidth }}
              className="absolute left-4 top-1/2 block -translate-y-1/2 overflow-hidden whitespace-nowrap"
            >
              {typingWord}
            </motion.span>
            <span
              aria-hidden
              ref={measureRef}
              className="pointer-events-none select-none whitespace-nowrap opacity-0"
            >
              {typingWord}
            </span>
          </span>
          <motion.span
            aria-hidden
            style={{ x: caretTranslate }}
            animate={{ opacity: [1, 1, 0.25, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.4 }}
            className="pointer-events-none absolute left-[1rem] top-1/2 h-13 w-[2px] -translate-y-1/2 rounded bg-blue-500"
          />
        </span>{" "}
        Mastery With Our Platform
      </h1>
      <p className="mt-6 max-w-2xl text-base text-neutral-500 sm:text-lg">
        Prepare confidently, practice effectively, and land your dream job
        faster with our smart interview platform
      </p>
      <div className="mt-10">
        <Link href="/sign-up">
          <Button className="group h-12 gap-3 rounded-full bg-blue-600 px-8 text-base font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-blue-500">
            <span>Start Now</span>
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-white text-blue-600 transition-transform group-hover:translate-x-1">
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </span>
          </Button>
        </Link>
      </div>
      <div className="relative mt-16 w-full max-w-3xl sm:mt-20">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[36px] border-[6px] border-blue-500 shadow-xl">
          <Image
            src="/landing.png"
            alt="Interview coach speaking into a microphone"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 90vw, 800px"
          />
        </div>
      </div>
    </section>
  )
}

export default Hero