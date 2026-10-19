<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { computed, defineAsyncComponent, useAttrs } from 'vue'
import { useAppStore } from '@/stores/app'
import { supportsGlobeRenderer } from '@/utils/globeCapability'

const props = defineProps<{
  nodes?: NodeData[]
}>()

const attrs = useAttrs()
const appStore = useAppStore()

const NodeEarthCobeGlobe = defineAsyncComponent(() => import('@/components/NodeEarthCobeGlobe.vue'))
const NodeEarthRealisticGlobe = defineAsyncComponent(() => import('@/components/NodeEarthRealisticGlobe.vue'))
const NodeEarthTiledMap = defineAsyncComponent(() => import('@/components/NodeEarthTiledMap.vue'))

const earthComponent = computed(() => {
  const components = {
    realistic: NodeEarthRealisticGlobe,
    cobe: NodeEarthCobeGlobe,
    tiled: NodeEarthTiledMap,
  }
  const renderer = appStore.earthRenderer
  // Keep the selected preference; only fall back for an unavailable WebGL API.
  // Do not swallow unrelated rendering errors to make the map appear healthy.
  if (renderer !== 'tiled' && !supportsGlobeRenderer(renderer))
    return NodeEarthTiledMap
  return components[renderer] ?? NodeEarthRealisticGlobe
})
</script>

<template>
  <component :is="earthComponent" v-bind="attrs" :nodes="props.nodes" />
</template>
