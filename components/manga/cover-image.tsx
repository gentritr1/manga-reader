import Image, { type ImageProps } from "next/image";

const DIRECT_COVERS = process.env.NEXT_PUBLIC_DIRECT_COVERS === "true";

export function MangaCoverImage({ alt, ...props }: ImageProps) {
  return (
    <Image
      {...props}
      alt={alt}
      unoptimized={DIRECT_COVERS || props.unoptimized}
    />
  );
}
