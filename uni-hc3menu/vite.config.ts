import { defineConfig } from "vite"
import uni from "@dcloudio/vite-plugin-uni"

export default defineConfig({
  resolve: {
    alias: {
      vue: "@dcloudio/uni-h5-vue/dist-x/vue.runtime.esm.js",
    },
  },
  plugins: [((uni as any).default || uni)()],
})
