cmake_minimum_required(VERSION 3.21)

project(OpenFlashCEF LANGUAGES C CXX)

# ============================================================
# Configuración del compilador
# ============================================================

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_compile_definitions(NOMINMAX)

if(MSVC)
    set(CMAKE_MSVC_RUNTIME_LIBRARY
        "MultiThreaded$<$<CONFIG:Debug>:Debug>"
    )
endif()

# ============================================================
# Ruta de CEF
# ============================================================

set(CEF_ROOT
    "C:/third_party/cef_binary_154.0.34+g14c5a08+chromium-154.0.8037.98_windows64"
)

if(NOT EXISTS "${CEF_ROOT}/include/cef_app.h")
    message(FATAL_ERROR
        "No se encontró include/cef_app.h. Revisa CEF_ROOT."
    )
endif()

if(NOT EXISTS "${CEF_ROOT}/Resources")
    message(FATAL_ERROR
        "No se encontró la carpeta Resources de CEF."
    )
endif()

foreach(CEF_CONFIG Debug Release)
    if(NOT EXISTS "${CEF_ROOT}/${CEF_CONFIG}/libcef.lib")
        message(FATAL_ERROR
            "No se encontró ${CEF_CONFIG}/libcef.lib."
        )
    endif()

    if(NOT EXISTS "${CEF_ROOT}/${CEF_CONFIG}/libcef.dll")
        message(FATAL_ERROR
            "No se encontró ${CEF_CONFIG}/libcef.dll."
        )
    endif()
endforeach()

# ============================================================
# Integración con CEF
# ============================================================

list(APPEND CMAKE_MODULE_PATH "${CEF_ROOT}/cmake")

find_package(CEF REQUIRED)

add_subdirectory(
    "${CEF_ROOT}/libcef_dll"
    "${CMAKE_CURRENT_BINARY_DIR}/libcef_dll_wrapper_build"
)

# ============================================================
# Ejecutable de Windows
# ============================================================

add_executable(OpenFlash WIN32
    src/main.cpp
    build/resource.rc
)

target_include_directories(OpenFlash PRIVATE
    "${CEF_ROOT}"
    "${CEF_ROOT}/include"
    "${CMAKE_CURRENT_SOURCE_DIR}/src"
)

# Seleccionar la biblioteca de importación según la configuración.
target_link_libraries(OpenFlash PRIVATE
    libcef_dll_wrapper
    "$<IF:$<CONFIG:Debug>,${CEF_ROOT}/Debug/libcef.lib,${CEF_ROOT}/Release/libcef.lib>"
    ${CEF_STANDARD_LIBS}
)

# ============================================================
# Copiar recursos y archivos de CEF al directorio del ejecutable
# ============================================================

set(CEF_RUNTIME_FILES
    chrome_elf.dll
    d3dcompiler_47.dll
    vk_swiftshader.dll
    vk_swiftshader_icd.json
    vulkan-1.dll
)

add_custom_command(TARGET OpenFlash POST_BUILD
    COMMAND "${CMAKE_COMMAND}" -E copy_directory
        "${CEF_ROOT}/Resources"
        "$<TARGET_FILE_DIR:OpenFlash>"

    COMMAND "${CMAKE_COMMAND}" -E copy_if_different
        "$<IF:$<CONFIG:Debug>,${CEF_ROOT}/Debug/libcef.dll,${CEF_ROOT}/Release/libcef.dll>"
        "$<TARGET_FILE_DIR:OpenFlash>"

    VERBATIM
    COMMENT "Copiando recursos principales de CEF..."
)

foreach(CEF_FILE IN LISTS CEF_RUNTIME_FILES)
    set(CEF_DEBUG_FILE "${CEF_ROOT}/Debug/${CEF_FILE}")
    set(CEF_RELEASE_FILE "${CEF_ROOT}/Release/${CEF_FILE}")

    if(EXISTS "${CEF_DEBUG_FILE}" AND EXISTS "${CEF_RELEASE_FILE}")
        add_custom_command(TARGET OpenFlash POST_BUILD
            COMMAND "${CMAKE_COMMAND}" -E copy_if_different
                "$<IF:$<CONFIG:Debug>,${CEF_DEBUG_FILE},${CEF_RELEASE_FILE}>"
                "$<TARGET_FILE_DIR:OpenFlash>"
            VERBATIM
            COMMENT "Copiando ${CEF_FILE}..."
        )
    elseif(EXISTS "${CEF_DEBUG_FILE}")
        add_custom_command(TARGET OpenFlash POST_BUILD
            COMMAND "${CMAKE_COMMAND}" -E copy_if_different
                "${CEF_DEBUG_FILE}"
                "$<TARGET_FILE_DIR:OpenFlash>"
            VERBATIM
            COMMENT "Copiando ${CEF_FILE}..."
        )
    elseif(EXISTS "${CEF_RELEASE_FILE}")
        add_custom_command(TARGET OpenFlash POST_BUILD
            COMMAND "${CMAKE_COMMAND}" -E copy_if_different
                "${CEF_RELEASE_FILE}"
                "$<TARGET_FILE_DIR:OpenFlash>"
            VERBATIM
            COMMENT "Copiando ${CEF_FILE}..."
        )
    else()
        message(WARNING "No se encontró ${CEF_FILE} en Debug ni Release.")
    endif()
endforeach()
