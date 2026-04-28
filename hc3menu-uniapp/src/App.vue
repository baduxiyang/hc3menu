<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { useSettingsStore } from "@/stores/settings";
import { useHc3Store } from "@/stores/hc3";
onLaunch(() => {
  const settings = useSettingsStore();
  settings.load();
});
onShow(() => {
  const hc3 = useHc3Store();
  hc3.startSync().catch(() => {});
});
onHide(() => {
  const hc3 = useHc3Store();
  hc3.stopSync();
});
</script>
<style></style>
