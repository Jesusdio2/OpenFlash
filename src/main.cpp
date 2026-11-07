
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <string>

#include "include/cef_app.h"
#include "include/cef_browser.h"
#include "include/cef_client.h"
#include "include/cef_life_span_handler.h"
#include "include/cef_load_handler.h"
#include "include/cef_request_handler.h"
#include "include/cef_task.h"
#include "include/internal/cef_win.h"

namespace
{
    constexpr wchar_t WINDOW_CLASS_NAME[] = L"OpenFlashCEFWindow";
    constexpr wchar_t WINDOW_TITLE[] = L"OpenFlash";

    constexpr int WINDOW_WIDTH = 1280;
    constexpr int WINDOW_HEIGHT = 800;

    HWND g_mainWindow = nullptr;
    CefRefPtr<CefBrowser> g_browser;

    void Log(const std::wstring& message)
    {
        OutputDebugStringW((message + L"\r\n").c_str());
    }

    std::wstring GetApplicationDirectory()
    {
        wchar_t path[MAX_PATH]{};

        const DWORD length = GetModuleFileNameW(
            nullptr,
            path,
            MAX_PATH
        );

        if (length == 0 || length >= MAX_PATH)
            return L".";

        std::wstring result(path, length);
        const size_t separator = result.find_last_of(L"\\/");

        if (separator != std::wstring::npos)
            result.resize(separator);

        return result;
    }

    std::wstring GetStartUrl()
    {
        // Archivo HTML existente en el proyecto.
        return L"file:///C:/Users/Usuario/source/repos/OpenFlashCEF/dist/index.html";
    }

    LRESULT CALLBACK WindowProcedure(
        HWND hwnd,
        UINT message,
        WPARAM wParam,
        LPARAM lParam)
    {
        switch (message)
        {
        case WM_SIZE:
        {
            if (g_browser)
            {
                CefRefPtr<CefBrowserHost> host = g_browser->GetHost();

                if (host)
                    host->WasResized();
            }

            return 0;
        }

        case WM_SETFOCUS:
        {
            if (g_browser)
            {
                CefRefPtr<CefBrowserHost> host = g_browser->GetHost();

                if (host)
                    host->SetFocus(true);
            }

            return 0;
        }

        case WM_CLOSE:
            DestroyWindow(hwnd);
            return 0;

        case WM_DESTROY:
            g_mainWindow = nullptr;
            PostQuitMessage(0);
            return 0;
        }

        return DefWindowProcW(hwnd, message, wParam, lParam);
    }

    class SimpleClient final
        : public CefClient,
          public CefLifeSpanHandler,
          public CefLoadHandler
    {
    public:
        CefRefPtr<CefLifeSpanHandler> GetLifeSpanHandler() override
        {
            return this;
        }

        CefRefPtr<CefLoadHandler> GetLoadHandler() override
        {
            return this;
        }

        void OnAfterCreated(CefRefPtr<CefBrowser> browser) override
        {
            g_browser = browser;
            Log(L"OpenFlash: navegador creado.");
        }

        void OnBeforeClose(CefRefPtr<CefBrowser> browser) override
        {
            if (g_browser && g_browser->IsSame(browser))
                g_browser = nullptr;

            Log(L"OpenFlash: navegador cerrado.");
        }

        void OnLoadStart(
            CefRefPtr<CefBrowser> browser,
            CefRefPtr<CefFrame> frame,
            TransitionType transitionType) override
        {
            if (frame && frame->IsMain())
            {
                Log(
                    L"OpenFlash: iniciando carga: " +
                    frame->GetURL().ToWString()
                );
            }
        }

        void OnLoadEnd(
            CefRefPtr<CefBrowser> browser,
            CefRefPtr<CefFrame> frame,
            int httpStatusCode) override
        {
            if (frame && frame->IsMain())
            {
                Log(
                    L"OpenFlash: carga terminada: " +
                    frame->GetURL().ToWString()
                );
            }
        }

        void OnLoadError(
            CefRefPtr<CefBrowser> browser,
            CefRefPtr<CefFrame> frame,
            ErrorCode errorCode,
            const CefString& errorText,
            const CefString& failedUrl) override
        {
            if (!frame || !frame->IsMain())
                return;

            std::wstring message =
                L"OpenFlash: error de carga.\r\nCodigo: " +
                std::to_wstring(static_cast<int>(errorCode)) +
                L"\r\nDescripcion: " + errorText.ToWString() +
                L"\r\nURL: " + failedUrl.ToWString();

            Log(message);
        }

        IMPLEMENT_REFCOUNTING(SimpleClient);
    };

    bool RegisterMainWindowClass(HINSTANCE instance)
    {
        WNDCLASSEXW windowClass{};
        windowClass.cbSize = sizeof(windowClass);
        windowClass.style = CS_HREDRAW | CS_VREDRAW;
        windowClass.lpfnWndProc = WindowProcedure;
        windowClass.hInstance = instance;
        windowClass.hCursor = LoadCursorW(
            nullptr,
            MAKEINTRESOURCEW(32512)
        );
        windowClass.hIcon = LoadIconW(
            nullptr,
            MAKEINTRESOURCEW(32512)
        );
        windowClass.hbrBackground =
            reinterpret_cast<HBRUSH>(COLOR_WINDOW + 1);
        windowClass.lpszClassName = WINDOW_CLASS_NAME;

        if (!RegisterClassExW(&windowClass))
        {
            Log(
                L"OpenFlash: RegisterClassExW fallo. Error: " +
                std::to_wstring(GetLastError())
            );
            return false;
        }

        return true;
    }

    bool CreateMainWindow(HINSTANCE instance)
    {
        if (!RegisterMainWindowClass(instance))
            return false;

        RECT rect{
            0,
            0,
            WINDOW_WIDTH,
            WINDOW_HEIGHT
        };

        AdjustWindowRect(&rect, WS_OVERLAPPEDWINDOW, FALSE);

        g_mainWindow = CreateWindowExW(
            0,
            WINDOW_CLASS_NAME,
            WINDOW_TITLE,
            WS_OVERLAPPEDWINDOW,
            CW_USEDEFAULT,
            CW_USEDEFAULT,
            rect.right - rect.left,
            rect.bottom - rect.top,
            nullptr,
            nullptr,
            instance,
            nullptr
        );

        if (!g_mainWindow)
        {
            Log(
                L"OpenFlash: CreateWindowExW fallo. Error: " +
                std::to_wstring(GetLastError())
            );
            return false;
        }

        ShowWindow(g_mainWindow, SW_SHOW);
        UpdateWindow(g_mainWindow);

        return true;
    }

    bool CreateBrowser()
    {
        if (!g_mainWindow)
            return false;

        RECT clientRect{};

        if (!GetClientRect(g_mainWindow, &clientRect))
        {
            Log(L"OpenFlash: GetClientRect fallo.");
            return false;
        }

        const int width = clientRect.right - clientRect.left;
        const int height = clientRect.bottom - clientRect.top;

        CefWindowInfo windowInfo;

        windowInfo.SetAsChild(
            g_mainWindow,
            CefRect(0, 0, width, height)
        );

        // Chromium integrado, sin la interfaz tradicional de Chrome.
        windowInfo.runtime_style = CEF_RUNTIME_STYLE_ALLOY;

        CefBrowserSettings browserSettings{};

        CefRefPtr<SimpleClient> client = new SimpleClient();

        const std::wstring url = GetStartUrl();

        Log(L"OpenFlash: URL inicial: " + url);

        const bool created = CefBrowserHost::CreateBrowser(
            windowInfo,
            client,
            url,
            browserSettings,
            nullptr,
            nullptr
        );

        if (!created)
        {
            Log(L"OpenFlash: CefBrowserHost::CreateBrowser fallo.");
            return false;
        }

        return true;
    }
}

int APIENTRY wWinMain(
    HINSTANCE hInstance,
    HINSTANCE,
    LPWSTR,
    int nCmdShow)
{
    CefMainArgs mainArgs(hInstance);

    CefRefPtr<CefApp> app;

    const int subprocessExitCode = CefExecuteProcess(
        mainArgs,
        app,
        nullptr
    );

    if (subprocessExitCode >= 0)
        return subprocessExitCode;

    CefSettings settings{};

    settings.no_sandbox = true;
    settings.multi_threaded_message_loop = false;
    settings.log_severity = LOGSEVERITY_INFO;

    const std::wstring logPath =
        GetApplicationDirectory() + L"\\cef.log";

    CefString(&settings.log_file) = logPath;

    if (!CefInitialize(mainArgs, settings, app, nullptr))
    {
        Log(L"OpenFlash: CefInitialize fallo.");
        return 1;
    }

    if (!CreateMainWindow(hInstance))
    {
        CefShutdown();
        return 1;
    }

    ShowWindow(g_mainWindow, nCmdShow);
    UpdateWindow(g_mainWindow);

    if (!CreateBrowser())
    {
        DestroyWindow(g_mainWindow);
        CefShutdown();
        return 1;
    }

    MSG message{};

    while (true)
    {
        const BOOL result = GetMessageW(&message, nullptr, 0, 0);

        if (result <= 0)
            break;

        TranslateMessage(&message);
        DispatchMessageW(&message);

        CefDoMessageLoopWork();
    }

    g_browser = nullptr;

    CefShutdown();

    return static_cast<int>(message.wParam);
}
