<script lang="ts">
  export let label: string = 'Uploading…'
  export let fileName: string = ''
  export let progress: number = 0 // 0 - 100

  $: label = progress === 100 ? 'Done' : label

  // Format percentage based on value - show decimals during upload, whole number when complete
  $: formattedProgress = progress === 100 ? "100%" : progress.toFixed(2) + "%"
</script>

<div class="flex justify-between mb-1">
  <div class="flex flex-wrap items-baseline text-base max-w-full truncate">
    <span class="font-medium mr-2 text-gray-900">{label}</span>
    {#if fileName}
      <div class="font-normal text-sm truncate text-gray-900">{fileName}</div>
    {/if}
  </div>
  <span class="flex-shrink-0 ml-2 w-14 text-right text-sm font-medium text-primary"
    >{formattedProgress}</span
  >
</div>
<div class="w-full bg-gray-300 rounded-full h-2.5">
  <div class="bg-primary h-2.5 rounded-full" style="min-width: 3%; width: {progress}%" />
</div>
