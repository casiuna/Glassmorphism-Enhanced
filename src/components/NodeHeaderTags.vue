<script setup lang="ts">
import { computed } from 'vue'
import { parseNodeDisplayTags } from '@/utils/nodeDisplayTags'

const props = defineProps<{ tags?: string, visible: boolean }>()
const tags = computed(() => props.visible ? parseNodeDisplayTags(props.tags) : [])
</script>

<template>
  <div v-if="tags.length" data-node-header-tags class="flex min-w-0 flex-1 flex-wrap justify-end gap-1 self-start" aria-label="自定义标签">
    <span
      v-for="(tag, index) in tags" :key="`${index}-${tag.text}`"
      data-node-user-tag
      :title="tag.text"
      class="max-w-full truncate rounded-full border border-muted-foreground/20 bg-slate-500/10 px-2 py-0.5 text-[10px] leading-tight text-muted-foreground"
    >{{ tag.text }}</span>
  </div>
</template>
