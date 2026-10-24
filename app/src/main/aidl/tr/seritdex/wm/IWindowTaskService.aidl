package tr.seritdex.wm;
interface IWindowTaskService {
    String listTasks() = 0;
    boolean resizeTask(int taskId, int left, int top, int right, int bottom, int viewportWidth, int viewportHeight) = 1;
    boolean focusTask(int taskId) = 2;
    void destroy() = 16777114;
}
