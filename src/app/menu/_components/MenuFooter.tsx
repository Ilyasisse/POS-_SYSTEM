import Image from "next/image";

export default function MenuFooter({ cafeName }: { cafeName: string }) {
  return (
    <footer id="contact" className="dark:bg-background bg-[#201108] text-[#f8eee3]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 lg:px-8 xl:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[18px]">
              <Image
                src="/newer_logo.png"
                alt={cafeName}
                width={36}
                height={36}
                sizes="36px"
                className="h-25 w-25 max-w-none shrink-0 object-contain"
              />
            </div>
            <div>
              <p className="text-sm tracking-[0.32em] text-[#f0d4ae] uppercase">{cafeName}</p>
              <p className="text-sm text-white/65">Warm coffee, quality food, and daily comfort.</p>
            </div>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-7 text-white/62">
            Fresh meals, warm drinks, and daily comfort served with care.
          </p>
        </div>

        <div>
          <p className="text-lg font-semibold text-white">Address</p>
          <p className="text-md mt-4 leading-7 text-white/68">Jidka Airport Bosaso</p>
        </div>

        <div>
          <p className="text-lg font-semibold text-white">Contact</p>
          <p className="mt-4 text-sm leading-7 text-white/68">+252 90 7796071</p>
        </div>

        <div>
          <p className="text-lg font-semibold text-white">Opening Hours</p>
          <p className="mt-4 text-sm leading-7 text-white/68">
            Saturday - Friday: 7:00 AM - 2:00 AM
          </p>
        </div>
      </div>
    </footer>
  );
}
