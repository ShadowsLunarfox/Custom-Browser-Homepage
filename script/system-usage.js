// CPU counters are cumulative. Only intervals describe current CPU usage.
(() => {
  function cpuSample(info) {
    if (!Array.isArray(info?.processors) || !info.processors.length) throw new Error("Invalid CPU sample");
    return info.processors.map(processor => {
      const {total,idle}=processor.usage || {};
      if (!Number.isFinite(total)||!Number.isFinite(idle)||total<0||idle<0||idle>total) throw new Error("Invalid CPU counters");
      return {total,idle};
    });
  }
  function cpuUsage(previous,current) {
    if (!previous || previous.length!==current.length) return null;
    let total=0,idle=0;
    for(let index=0;index<current.length;index++) {
      const elapsed=current[index].total-previous[index].total,resting=current[index].idle-previous[index].idle;
      if(elapsed<=0||resting<0||resting>elapsed)return null;
      total+=elapsed;idle+=resting;
    }
    return Math.max(0,Math.min(100,(1-idle/total)*100));
  }
  function memoryUsage(info) {
    const total=info?.capacity,available=info?.availableCapacity;
    if(!Number.isFinite(total)||total<=0||!Number.isFinite(available)||available<0||available>total)throw new Error("Invalid memory sample");
    return {used:total-available,total,percent:(total-available)/total*100};
  }
  globalThis.lunarSystemUsage={cpuSample,cpuUsage,memoryUsage};
})();
