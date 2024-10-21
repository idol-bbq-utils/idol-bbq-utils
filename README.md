# tweet-saver

## 性能参考

1C1G 同时只能存在一个tab进行处理

一天挂一次，4分钟做完任务

nginx照常使用，无法使用docker进行ffmpeg转播

2C1G 没测多tab

3天挂一次，2分钟左右做完任务

使用docker进行ffmpeg转播，表现为kswapd0 20%左右的占用

内存占满，需要swap换页，导致问题发生
