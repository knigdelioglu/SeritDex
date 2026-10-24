package tr.seritdex.wm;
interface IWindowTaskService {
    String listTasks();
    boolean resizeTask(int taskId, int left, int top, int right, int bottom);
    boolean focusTask(int taskId);
    void destroy();
}
